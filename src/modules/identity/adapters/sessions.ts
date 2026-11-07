import { createHash } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import type { SessionStore } from "../application/sessions.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export class PostgresSessions implements SessionStore {
  constructor(private audit: SecurityAudit) {}
  private async authorize(tx: Transaction, token: string) {
    const candidate = (
      await tx.query(
        "SELECT account_id FROM identity.sessions WHERE token_hash=$1",
        [hash(token)],
      )
    ).rows[0];
    if (!candidate)
      throw new AppError(
        "AUTH_REQUIRED",
        "Sign in again to manage sessions.",
        401,
      );
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,4))", [
      candidate.account_id,
    ]);
    const row = (
      await tx.query(
        "SELECT s.id,s.account_id FROM identity.sessions s JOIN identity.accounts a ON a.id=s.account_id WHERE token_hash=$1 AND expires_at>clock_timestamp() AND a.status='active' FOR UPDATE OF s FOR SHARE OF a",
        [hash(token)],
      )
    ).rows[0];
    if (!row)
      throw new AppError(
        "AUTH_REQUIRED",
        "Sign in again to manage sessions.",
        401,
      );
    return row;
  }
  list(token: string) {
    return transaction(async (tx) => {
      const actor = await this.authorize(tx, token);
      const rows = await tx.query(
        "SELECT id,created_at,expires_at,id=$2 current FROM identity.sessions WHERE account_id=$1 AND expires_at>clock_timestamp() ORDER BY (id=$2) DESC,expires_at DESC LIMIT 100",
        [actor.account_id, actor.id],
      );
      return {
        items: rows.rows,
        serverTime: (await tx.query("SELECT clock_timestamp() now")).rows[0]
          .now,
      };
    });
  }
  revoke(token: string, targetId: string | "others") {
    return transaction(async (tx) => {
      const actor = await this.authorize(tx, token);
      if (targetId === actor.id)
        throw new AppError(
          "USE_LOGOUT",
          "Use Sign out to end your current session.",
          409,
        );
      const removed =
        targetId === "others"
          ? await tx.query(
              "DELETE FROM identity.sessions WHERE account_id=$1 AND id<>$2 RETURNING id",
              [actor.account_id, actor.id],
            )
          : await tx.query(
              "DELETE FROM identity.sessions WHERE account_id=$1 AND id=$2 AND id<>$3 RETURNING id",
              [actor.account_id, targetId, actor.id],
            );
      // Unknown, already-revoked and foreign IDs have the same no-op result.
      if (removed.rowCount)
        await this.audit.record(
          tx,
          actor.account_id,
          "sessions.revoked",
          actor.account_id,
          {
            scope: targetId === "others" ? "others" : "single",
            sessionIds: removed.rows.map((r) => r.id),
          },
        );
      return { revoked: true };
    });
  }
}
