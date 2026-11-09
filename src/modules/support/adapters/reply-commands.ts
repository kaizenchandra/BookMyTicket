import { createHash } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export class ReplyCommands {
  fingerprint(input: unknown) {
    return createHash("sha256").update(JSON.stringify(input)).digest("hex");
  }
  async serialize(tx: Transaction, actor: string, key?: string) {
    if (key)
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,17))", [
        actor,
      ]);
  }
  async previous(
    tx: Transaction,
    actor: string,
    channel: string,
    key: string | undefined,
    fingerprint: string,
  ) {
    if (!key) return null;
    const row = (
      await tx.query(
        "SELECT fingerprint,result FROM support.reply_commands WHERE actor_id=$1 AND channel=$2 AND operation_key=$3",
        [actor, channel, key],
      )
    ).rows[0];
    if (!row) return null;
    if (row.fingerprint !== fingerprint)
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "This reply key was used with different input.",
        409,
      );
    return { ...row.result, replayed: true };
  }
  async save(
    tx: Transaction,
    actor: string,
    channel: string,
    key: string | undefined,
    fingerprint: string,
    result: unknown,
  ) {
    if (key)
      await tx.query(
        "INSERT INTO support.reply_commands(actor_id,channel,operation_key,fingerprint,result) VALUES($1,$2,$3,$4,$5)",
        [actor, channel, key, fingerprint, result],
      );
  }
}
