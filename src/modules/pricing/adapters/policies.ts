import { randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import type { PolicyStore, PolicyInput } from "../application/policies.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresPolicies implements PolicyStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async create(actorId: string, input: PolicyInput) {
    return (
      await pool.query(
        "INSERT INTO pricing.policies(id,label,configuration,approved_by,approval_reason) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [randomUUID(), input.label, input.configuration, actorId, input.reason],
      )
    ).rows[0];
  }
  async list() {
    return (
      await pool.query(
        "SELECT * FROM pricing.policies ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
  }
  async assignment(id: string) {
    return (
      (
        await pool.query(
          "SELECT occurrence_id,policy_id,version,updated_at FROM pricing.assignments WHERE occurrence_id=$1",
          [id],
        )
      ).rows[0] ?? null
    );
  }
  async assign(
    tx: Transaction,
    actorId: string,
    occurrenceId: string,
    policyId: string,
    version: number,
  ) {
    if (
      !(
        await tx.query("SELECT 1 FROM pricing.policies WHERE id=$1", [policyId])
      ).rowCount
    )
      throw new AppError("NOT_FOUND", "Approved policy not found.", 404);
    const current = (
      await tx.query(
        "SELECT version FROM pricing.assignments WHERE occurrence_id=$1 FOR UPDATE",
        [occurrenceId],
      )
    ).rows[0];
    if ((current?.version ?? 0) !== version)
      throw new AppError(
        "VERSION_CONFLICT",
        "The occurrence policy changed. Refresh before applying a policy.",
        409,
      );
    return (
      await tx.query(
        "INSERT INTO pricing.assignments(occurrence_id,policy_id,updated_by) VALUES($1,$2,$3) ON CONFLICT(occurrence_id) DO UPDATE SET policy_id=$2,version=pricing.assignments.version+1,updated_by=$3,updated_at=clock_timestamp() RETURNING *",
        [occurrenceId, policyId, actorId],
      )
    ).rows[0];
  }
}
