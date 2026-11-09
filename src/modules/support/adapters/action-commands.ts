import { createHash } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export class ActionCommands {
  fingerprint(input: unknown) {
    return createHash("sha256").update(JSON.stringify(input)).digest("hex");
  }
  async serialize(tx: Transaction, actor: string, key?: string) {
    if (key)
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,18))", [
        actor,
      ]);
  }
  async previous(
    tx: Transaction,
    actor: string,
    key: string | undefined,
    fingerprint: string,
  ) {
    if (!key) return null;
    const row = (
      await tx.query(
        "SELECT fingerprint,result FROM support.action_commands WHERE actor_id=$1 AND operation_key=$2",
        [actor, key],
      )
    ).rows[0];
    if (!row) return null;
    if (row.fingerprint !== fingerprint)
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "This action key was used with different input.",
        409,
      );
    return { ...row.result, replayed: true };
  }
  async save(
    tx: Transaction,
    actor: string,
    key: string | undefined,
    fingerprint: string,
    result: unknown,
  ) {
    if (key)
      await tx.query(
        "INSERT INTO support.action_commands(actor_id,operation_key,fingerprint,result) VALUES($1,$2,$3,$4)",
        [actor, key, fingerprint, result],
      );
  }
}
