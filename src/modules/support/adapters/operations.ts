import { randomUUID } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type {
  SupportOperationsPort,
  CaseFilters,
} from "../application/operations.ts";
import { transitionCase } from "../domain/workflow.ts";
export class PostgresSupportOperations implements SupportOperationsPort {
  constructor(private audit: SecurityAudit) {}
  async queue(actor: string, f: CaseFilters) {
    return (
      await pool.query(
        "SELECT id,subject,category,state,priority,assigned_to,version,created_at,updated_at FROM support.cases WHERE ($1::text IS NULL OR state=$1) AND ($2::text IS NULL OR priority=$2) AND ($3::text IS NULL OR category=$3) AND ($4::text IS NULL OR ($4='mine' AND assigned_to=$5) OR ($4='unassigned' AND assigned_to IS NULL)) ORDER BY created_at DESC,id LIMIT 100",
        [
          f.state ?? null,
          f.priority ?? null,
          f.category ?? null,
          f.assignment ?? null,
          actor,
        ],
      )
    ).rows;
  }
  async detail(actor: string, id: string) {
    return transaction(async (tx) => {
      const row = (
        await tx.query("SELECT * FROM support.cases WHERE id=$1 FOR SHARE", [
          id,
        ])
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
      const messages = (
        await tx.query(
          "SELECT id,audience,body,created_at FROM support.messages WHERE case_id=$1 ORDER BY created_at,id",
          [id],
        )
      ).rows;
      await this.audit.record(tx, actor, "support.case.read", id, {});
      return { ...row, messages, serverTime: new Date().toISOString() };
    });
  }
  async change(
    actor: string,
    id: string,
    input: Parameters<SupportOperationsPort["change"]>[2],
  ) {
    return transaction(async (tx) => {
      const row = (
        await tx.query("SELECT * FROM support.cases WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
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
      return result;
    });
  }
  async reply(
    actor: string,
    id: string,
    input: Parameters<SupportOperationsPort["reply"]>[2],
  ) {
    return transaction(async (tx) => {
      const row = (
        await tx.query("SELECT * FROM support.cases WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
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
      return { id: message, version: row.version + 1 };
    });
  }
}
