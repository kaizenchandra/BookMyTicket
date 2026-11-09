import { createHash } from "node:crypto";
import { transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import type {
  DurableEvents,
  SecurityAudit,
} from "../../reporting/contracts/index.ts";
import type {
  AssignmentInput,
  AssignmentPort,
} from "../application/assignment.ts";
import { assignedState } from "../domain/assignment.ts";
export class PostgresAssignment implements AssignmentPort {
  constructor(
    private staff: StaffAuthorization,
    private audit: SecurityAudit,
    private events: DurableEvents,
  ) {}
  assign(actor: string, id: string, key: string, input: AssignmentInput) {
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([id, input.version, input.assigneeId, input.reason]),
      )
      .digest("hex");
    return transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,14))", [
        actor,
      ]);
      const row = (
        await tx.query("SELECT * FROM support.cases WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Case not found.", 404);
      // Acquire identity locks deterministically; permission changes serialize with this transaction.
      for (const account of [...new Set([actor, input.assigneeId])].sort()) {
        await this.staff.requirePermission(tx, account, "support");
        if (account === actor)
          await this.staff.requirePermission(tx, account, "support_assign");
      }
      const previous = (
        await tx.query(
          "SELECT fingerprint,result FROM support.assignment_commands WHERE actor_id=$1 AND operation_key=$2",
          [actor, key],
        )
      ).rows[0];
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "This assignment key was used with different input.",
            409,
          );
        return { ...previous.result, replayed: true };
      }
      if (row.version !== input.version)
        throw new AppError(
          "CONFLICT",
          "Case changed. Refresh before assigning.",
          409,
        );
      const state = assignedState(row.state);
      const saved = (
        await tx.query(
          "UPDATE support.cases SET assigned_to=$2,state=$3,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING id,assigned_to,state,version,updated_at",
          [id, input.assigneeId, state],
        )
      ).rows[0];
      await this.audit.record(tx, actor, "support.case.assigned", id, {
        previousAssignee: row.assigned_to,
        assignee: input.assigneeId,
        reason: input.reason,
        previousVersion: row.version,
        version: saved.version,
        outcome: "success",
      });
      await this.events.publish(tx, "support.case_assigned", id, {
        ownerId: input.assigneeId,
        caseVersion: saved.version,
      });
      await tx.query(
        "INSERT INTO support.assignment_commands(actor_id,operation_key,fingerprint,result) VALUES($1,$2,$3,$4)",
        [actor, key, fingerprint, saved],
      );
      return saved;
    });
  }
}
