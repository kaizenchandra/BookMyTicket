import { createHash, randomUUID } from "node:crypto";
import { transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type {
  EscalationPort,
  EscalationInput,
} from "../application/escalation.ts";
import { requireEscalatable } from "../domain/escalation.ts";
export class PostgresEscalation implements EscalationPort {
  constructor(private audit: SecurityAudit) {}
  request(owner: string, id: string, key: string, input: EscalationInput) {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([id, input.version, input.reason]))
      .digest("hex");
    return transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,15))", [
        owner,
      ]);
      const row = (
        await tx.query(
          "SELECT * FROM support.cases WHERE id=$1 AND owner_id=$2 FOR UPDATE",
          [id, owner],
        )
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
      const previous = (
        await tx.query(
          "SELECT fingerprint,result FROM support.escalation_commands WHERE owner_id=$1 AND operation_key=$2",
          [owner, key],
        )
      ).rows[0];
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "This request key was used with different input.",
            409,
          );
        return { ...previous.result, replayed: true };
      }
      if (row.version !== input.version)
        throw new AppError(
          "CONFLICT",
          "Case changed. Refresh before requesting escalation.",
          409,
        );
      requireEscalatable(row.state);
      const saved = (
        await tx.query(
          "UPDATE support.cases SET state='escalated',assigned_to=NULL,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING id,state,version,updated_at",
          [id],
        )
      ).rows[0];
      const messageId = randomUUID();
      await tx.query(
        "INSERT INTO support.messages(id,case_id,author_id,audience,body) VALUES($1,$2,$3,'customer',$4)",
        [messageId, id, owner, "Escalation requested: " + input.reason],
      );
      await this.audit.record(
        tx,
        owner,
        "support.case.customer_escalation",
        id,
        {
          messageId,
          previousVersion: row.version,
          version: saved.version,
          outcome: "success",
        },
      );
      await tx.query(
        "INSERT INTO support.escalation_commands(owner_id,operation_key,fingerprint,result) VALUES($1,$2,$3,$4)",
        [owner, key, fingerprint, saved],
      );
      return saved;
    });
  }
}
