import type { Transaction } from "../../../shared/database.ts";
import type { AdminActivityReader } from "../contracts/admin-history.ts";
import { AppError } from "../../../shared/errors.ts";
import { pageScope } from "../../../shared/admin-pagination.ts";
import { z } from "zod";
const cursorSchema = z
  .object({
    id: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .refine((x) => BigInt(x) <= 9223372036854775807n),
    scope: z.string(),
  })
  .strict();
export class PostgresAdminActivity implements AdminActivityReader {
  async read(tx: Transaction, actor: string, target: string, after?: string) {
    target = target.toLowerCase();
    const scope = pageScope(actor, target);
    let before: string | null = null;
    if (after)
      try {
        const c = cursorSchema.parse(
          JSON.parse(Buffer.from(after, "base64url").toString()),
        );
        if (c.scope !== scope) throw Error();
        before = c.id;
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Account or history scope changed.",
          422,
        );
      }
    const r = await tx.query(
      `SELECT id::text,actor_id,action,target,created_at,
 CASE WHEN action IN ('identity.admin.created','identity.admin.changed','identity.role.created','identity.role.changed') THEN jsonb_build_object('reason',details->'reason','before',details->'before','after',details->'after','roles',details->'roles','permissions',details->'permissions') ELSE '{}'::jsonb END AS change
 FROM reporting.audit WHERE (lower(target)=$1 OR actor_id=$1::uuid OR details->'affectedAccounts' ? $1) AND ($2::bigint IS NULL OR id<$2) ORDER BY id DESC LIMIT 26`,
      [target, before],
    );
    const items = r.rows.slice(0, 25);
    return {
      items,
      nextCursor:
        r.rows.length > 25
          ? Buffer.from(JSON.stringify({ id: items[24].id, scope })).toString(
              "base64url",
            )
          : null,
    };
  }
}
