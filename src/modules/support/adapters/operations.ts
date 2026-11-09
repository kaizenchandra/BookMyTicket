import { ActionCommands } from "./action-commands.ts";
import { ReplyCommands } from "./reply-commands.ts";
import type { SupportBookingReader } from "../../bookings/contracts/index.ts";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  DurableEvents,
  SecurityAudit,
} from "../../reporting/contracts/index.ts";
import type {
  SupportOperationsPort,
  CaseFilters,
} from "../application/operations.ts";
import { transitionCase } from "../domain/workflow.ts";
export class PostgresSupportOperations implements SupportOperationsPort {
  constructor(
    private audit: SecurityAudit,
    private bookings: SupportBookingReader,
    private events: DurableEvents,
  ) {}
  async queue(actor: string, f: CaseFilters) {
    const scope = createHash("sha256")
      .update(
        JSON.stringify([
          actor,
          f.state ?? null,
          f.priority ?? null,
          f.category ?? null,
          f.assignment ?? null,
        ]),
      )
      .digest("hex");
    let cursor: { id: string; time: string; scope: string } | undefined;
    if (f.after) {
      try {
        cursor = z
          .object({
            id: z.uuid(),
            time: z.iso.datetime(),
            scope: z.string().length(64),
          })
          .strict()
          .parse(JSON.parse(Buffer.from(f.after, "base64url").toString()));
        if (cursor.scope !== scope) throw new Error();
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Account or filters changed. Return to the first page.",
          422,
        );
      }
    }
    const { rows } = await pool.query(
      `SELECT id,subject,category,state,priority,assigned_to,version,created_at,updated_at,
        to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
       FROM support.cases
       WHERE ($1::text IS NULL OR state=$1) AND ($2::text IS NULL OR priority=$2)
         AND ($3::text IS NULL OR category=$3)
         AND ($4::text IS NULL OR ($4='mine' AND assigned_to=$5) OR ($4='unassigned' AND assigned_to IS NULL))
         AND ($6::timestamptz IS NULL OR (created_at,id)<($6::timestamptz,$7::uuid))
       ORDER BY created_at DESC,id DESC LIMIT 101`,
      [
        f.state ?? null,
        f.priority ?? null,
        f.category ?? null,
        f.assignment ?? null,
        actor,
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

  async detail(actor: string, id: string, after?: string) {
    const scope = createHash("sha256")
      .update(JSON.stringify(["staff-thread", actor, id]))
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
    return transaction(async (tx) => {
      const row = (
        await tx.query("SELECT * FROM support.cases WHERE id=$1 FOR SHARE", [
          id,
        ])
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
      const { rows } = await tx.query(
        `SELECT id,audience,body,created_at,
         to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
         FROM support.messages WHERE case_id=$1
         AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid))
         ORDER BY created_at DESC,id DESC LIMIT 51`,
        [id, cursor?.time ?? null, cursor?.id ?? null],
      );
      const page = rows.slice(0, 50),
        last = page[49];
      const messages = page
        .map(({ page_time, ...message }) => message)
        .reverse();
      await this.audit.record(tx, actor, "support.case.read", id, {
        messageCount: messages.length,
        olderPage: !!after,
      });
      return {
        ...row,
        messages,
        nextMessageCursor:
          rows.length > 50
            ? Buffer.from(
                JSON.stringify({ id: last.id, time: last.page_time, scope }),
              ).toString("base64url")
            : null,
        booking: row.booking_id
          ? await this.bookings.readOwned(tx, row.owner_id, row.booking_id)
          : null,
        serverTime: new Date().toISOString(),
      };
    });
  }
  async change(
    actor: string,
    id: string,
    input: Parameters<SupportOperationsPort["change"]>[2],
    operationKey?: string,
  ) {
    const commands = new ActionCommands();
    const fingerprint = commands.fingerprint([
      id,
      input.version,
      input.action,
      input.priority ?? null,
      input.reason,
    ]);
    return transaction(async (tx) => {
      await commands.serialize(tx, actor, operationKey);
      const row = (
        await tx.query("SELECT * FROM support.cases WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
      const previous = await commands.previous(
        tx,
        actor,
        operationKey,
        fingerprint,
      );
      if (previous) return previous;
      if (row.version !== input.version)
        throw new AppError(
          "CONFLICT",
          "Case changed. Refresh before applying this action.",
        );
      const next = transitionCase(row, actor, input.action, input.priority);
      const result = (
        await tx.query(
          "UPDATE support.cases SET state=$2,assigned_to=$3,priority=$4,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING *",
          [id, next.state, next.assigned_to, next.priority],
        )
      ).rows[0];
      await this.audit.record(tx, actor, "support.case." + input.action, id, {
        reason: input.reason,
        previousVersion: row.version,
        state: result.state,
        priority: result.priority,
      });
      await commands.save(tx, actor, operationKey, fingerprint, result);
      return result;
    });
  }
  async reply(
    actor: string,
    id: string,
    input: Parameters<SupportOperationsPort["reply"]>[2],
    operationKey?: string,
  ) {
    const commands = new ReplyCommands(),
      fingerprint = commands.fingerprint([
        id,
        input.version,
        input.audience,
        input.body,
      ]);
    return transaction(async (tx) => {
      await commands.serialize(tx, actor, operationKey);
      const row = (
        await tx.query("SELECT * FROM support.cases WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
      const previous = await commands.previous(
        tx,
        actor,
        "staff",
        operationKey,
        fingerprint,
      );
      if (previous) return previous;
      if (row.version !== input.version)
        throw new AppError("CONFLICT", "Case changed. Refresh before sending.");
      if (row.assigned_to !== actor || row.state === "resolved")
        throw new AppError("CONFLICT", "Claim an open case before replying.");
      const message = randomUUID();
      await tx.query(
        "INSERT INTO support.messages(id,case_id,author_id,audience,body) VALUES($1,$2,$3,$4,$5)",
        [message, id, actor, input.audience, input.body],
      );
      await tx.query(
        "UPDATE support.cases SET version=version+1,updated_at=clock_timestamp() WHERE id=$1",
        [id],
      );
      await this.audit.record(tx, actor, "support.case.reply", id, {
        messageId: message,
        audience: input.audience,
      });
      if (input.audience === "customer")
        await this.events.publish(tx, "support.staff_replied", id, {
          ownerId: row.owner_id,
          messageId: message,
        });
      const result = { id: message, version: row.version + 1 };
      await commands.save(
        tx,
        actor,
        "staff",
        operationKey,
        fingerprint,
        result,
      );
      return result;
    });
  }
}
