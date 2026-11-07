import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { CasesPort } from "../application/cases.ts";
export class PostgresCases implements CasesPort {
  constructor(private audit: SecurityAudit) {}
  async create(
    ownerId: string,
    subject: string,
    category: string,
    body: string,
  ) {
    return transaction(async (tx) => {
      const id = randomUUID();
      await tx.query(
        "INSERT INTO support.cases(id,owner_id,subject,category) VALUES($1,$2,$3,$4)",
        [id, ownerId, subject, category],
      );
      await tx.query(
        "INSERT INTO support.messages(id,case_id,author_id,audience,body) VALUES($1,$2,$3,'customer',$4)",
        [randomUUID(), id, ownerId, body],
      );
      return { id, state: "open" };
    });
  }
  async list(ownerId: string) {
    return (
      await pool.query(
        "SELECT id,subject,category,state,created_at FROM support.cases WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",
        [ownerId],
      )
    ).rows;
  }
  async queue() {
    return (
      await pool.query(
        "SELECT id,subject,category,state,created_at FROM support.cases ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
  }
  async messages(actorId: string, caseId: string, staff: boolean) {
    const exists = await pool.query(
      "SELECT 1 FROM support.cases WHERE id=$1 AND ($3 OR owner_id=$2)",
      [caseId, actorId, staff],
    );
    if (!exists.rowCount)
      throw new AppError("NOT_FOUND", "Case not found.", 404);
    return (
      await pool.query(
        "SELECT id,audience,body,created_at FROM support.messages WHERE case_id=$1 AND ($2 OR audience='customer') ORDER BY created_at",
        [caseId, staff],
      )
    ).rows;
  }
  async reply(
    actorId: string,
    caseId: string,
    body: string,
    audience: "customer" | "internal",
    staff: boolean,
  ) {
    if (!staff && audience === "internal")
      throw new AppError(
        "FORBIDDEN",
        "Internal notes require support permission.",
        403,
      );
    return transaction(async (tx) => {
      const row = (
        await tx.query(
          "SELECT * FROM support.cases WHERE id=$1 AND ($3 OR owner_id=$2) FOR UPDATE",
          [caseId, actorId, staff],
        )
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
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
      return { id };
    });
  }
}
