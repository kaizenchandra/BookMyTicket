import { ReplyCommands } from "./reply-commands.ts";
import type { SupportBookingReader } from "../../bookings/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { randomUUID, createHash } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import { z } from "zod";
import type { CustomerCaseFilters, CasesPort } from "../application/cases.ts";
export class PostgresCases implements CasesPort {
  constructor(
    private audit: SecurityAudit,
    private bookings: SupportBookingReader,
  ) {}
  async create(
    ownerId: string,
    subject: string,
    category: string,
    body: string,
    bookingId?: string,
    operationKey?: string,
  ) {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([subject, category, body, bookingId ?? null]))
      .digest("hex");
    return transaction(async (tx) => {
      if (operationKey) {
        await tx.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,16))",
          [ownerId],
        );
        const previous = (
          await tx.query(
            "SELECT fingerprint,result FROM support.creation_commands WHERE owner_id=$1 AND operation_key=$2",
            [ownerId, operationKey],
          )
        ).rows[0];
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new AppError(
              "IDEMPOTENCY_CONFLICT",
              "This case request key was used with different input.",
              409,
            );
          return { ...previous.result, replayed: true };
        }
      }
      if (bookingId) await this.bookings.readOwned(tx, ownerId, bookingId);
      const id = randomUUID();
      await tx.query(
        "INSERT INTO support.cases(id,owner_id,subject,category,booking_id) VALUES($1,$2,$3,$4,$5)",
        [id, ownerId, subject, category, bookingId ?? null],
      );
      await tx.query(
        "INSERT INTO support.messages(id,case_id,author_id,audience,body) VALUES($1,$2,$3,'customer',$4)",
        [randomUUID(), id, ownerId, body],
      );
      const result = { id, state: "open" };
      await this.audit.record(tx, ownerId, "support.case.created", id, {
        bookingId: bookingId ?? null,
        outcome: "success",
      });
      if (operationKey)
        await tx.query(
          "INSERT INTO support.creation_commands(owner_id,operation_key,fingerprint,result) VALUES($1,$2,$3,$4)",
          [ownerId, operationKey, fingerprint, result],
        );
      return result;
    });
  }
  async list(ownerId: string, filters: CustomerCaseFilters = {}) {
    const scope = createHash("sha256")
      .update(
        JSON.stringify(["customer-cases", ownerId, filters.caseId ?? null]),
      )
      .digest("hex");
    let cursor: { id: string; time: string; scope: string } | undefined;
    if (filters.after) {
      try {
        cursor = z
          .object({
            id: z.uuid(),
            time: z.iso.datetime(),
            scope: z.string().length(64),
          })
          .strict()
          .parse(
            JSON.parse(Buffer.from(filters.after, "base64url").toString()),
          );
        if (cursor.scope !== scope) throw new Error();
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Account or selection changed. Return to newest cases.",
          422,
        );
      }
    }
    const { rows } = await pool.query(
      `SELECT id,subject,category,state,version,booking_id,created_at,
       to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
       FROM support.cases WHERE owner_id=$1 AND ($2::uuid IS NULL OR id=$2)
       AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid))
       ORDER BY created_at DESC,id DESC LIMIT 101`,
      [
        ownerId,
        filters.caseId ?? null,
        cursor?.time ?? null,
        cursor?.id ?? null,
      ],
    );
    const items = rows.slice(0, 100),
      last = items[99];
    return {
      items: items.map(({ page_time, ...item }) => item),
      nextCursor:
        rows.length > 100
          ? Buffer.from(
              JSON.stringify({ id: last.id, time: last.page_time, scope }),
            ).toString("base64url")
          : null,
    };
  }
  async queue() {
    return (
      await pool.query(
        "SELECT id,subject,category,state,created_at FROM support.cases ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
  }
  async messages(
    actorId: string,
    caseId: string,
    staff: boolean,
    after?: string,
  ) {
    const exists = await pool.query(
      "SELECT 1 FROM support.cases WHERE id=$1 AND ($3 OR owner_id=$2)",
      [caseId, actorId, staff],
    );
    if (!exists.rowCount)
      throw new AppError("NOT_FOUND", "Case not found.", 404);
    const scope = createHash("sha256")
      .update(JSON.stringify(["case-messages", actorId, caseId, staff]))
      .digest("hex");
    let cursor: { id: string; time: string; scope: string } | undefined;
    if (after) {
      try {
        cursor = z
          .object({
            id: z.uuid(),
            time: z.iso.datetime(),
            scope: z.string().length(64),
          })
          .strict()
          .parse(JSON.parse(Buffer.from(after, "base64url").toString()));
        if (cursor.scope !== scope) throw new Error();
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Account or conversation changed. Return to latest messages.",
          422,
        );
      }
    }
    const { rows } = await pool.query(
      `SELECT id,audience,body,created_at,
       to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
       FROM support.messages WHERE case_id=$1 AND ($2 OR audience='customer')
       AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid))
       ORDER BY created_at DESC,id DESC LIMIT 51`,
      [caseId, staff, cursor?.time ?? null, cursor?.id ?? null],
    );
    const page = rows.slice(0, 50),
      last = page[49];
    return {
      items: page.map(({ page_time, ...item }) => item).reverse(),
      nextCursor:
        rows.length > 50
          ? Buffer.from(
              JSON.stringify({ id: last.id, time: last.page_time, scope }),
            ).toString("base64url")
          : null,
    };
  }
  async reply(
    actorId: string,
    caseId: string,
    body: string,
    audience: "customer" | "internal",
    staff: boolean,
    operationKey?: string,
  ) {
    if (!staff && audience === "internal")
      throw new AppError(
        "FORBIDDEN",
        "Internal notes require support permission.",
        403,
      );
    const commands = new ReplyCommands(),
      channel = staff ? "staff" : "customer",
      fingerprint = commands.fingerprint([caseId, body, audience]);
    return transaction(async (tx) => {
      await commands.serialize(tx, actorId, operationKey);
      const row = (
        await tx.query(
          "SELECT * FROM support.cases WHERE id=$1 AND ($3 OR owner_id=$2) FOR UPDATE",
          [caseId, actorId, staff],
        )
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
      const previous = await commands.previous(
        tx,
        actorId,
        channel,
        operationKey,
        fingerprint,
      );
      if (previous) return previous;
      const id = randomUUID();
      await tx.query(
        "INSERT INTO support.messages(id,case_id,author_id,audience,body) VALUES($1,$2,$3,$4,$5)",
        [id, caseId, actorId, audience, body],
      );
      await tx.query(
        "UPDATE support.cases SET version=version+1,updated_at=clock_timestamp(),state=CASE WHEN state='resolved' THEN 'open' ELSE state END,assigned_to=CASE WHEN state='resolved' THEN NULL ELSE assigned_to END WHERE id=$1",
        [caseId],
      );
      await this.audit.record(
        tx,
        actorId,
        "support.case.customer_reply",
        caseId,
        { messageId: id, reopened: row.state === "resolved" },
      );
      const result = { id };
      await commands.save(
        tx,
        actorId,
        channel,
        operationKey,
        fingerprint,
        result,
      );
      return result;
    });
  }
}
