import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { createHash } from "node:crypto";
import { z } from "zod";
import { transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  SupportDirectoryFilters,
  SupportDirectoryPort,
} from "../application/support-directory.ts";
import { PostgresStaffAuthorization } from "./staff-authorization.ts";
export class PostgresSupportDirectory implements SupportDirectoryPort {
  constructor(private audit: SecurityAudit) {}
  async search(actor: string, filters: SupportDirectoryFilters) {
    const query = filters.q.toLowerCase();
    const scope = createHash("sha256")
      .update(JSON.stringify([actor, query]))
      .digest("hex");
    let after: string | null = null;
    if (filters.after) {
      try {
        const cursor = z
          .object({ id: z.uuid(), scope: z.string().length(64) })
          .strict()
          .parse(
            JSON.parse(Buffer.from(filters.after, "base64url").toString()),
          );
        if (cursor.scope !== scope) throw new Error();
        after = cursor.id;
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Account or search changed. Search again from the first page.",
          422,
        );
      }
    }
    return transaction(async (tx) => {
      const staff = new PostgresStaffAuthorization();
      await staff.requirePermission(tx, actor, "support");
      await staff.requirePermission(tx, actor, "support_assign");
      const { rows } = await tx.query(
        `SELECT a.id,a.contact FROM identity.accounts a
         WHERE a.status='active' AND EXISTS (
           SELECT 1 FROM identity.grants g WHERE g.account_id=a.id
           AND g.permission='support' AND g.scope='platform')
         AND (a.contact ILIKE '%'||$1||'%' OR a.id::text=$2)
         AND ($3::uuid IS NULL OR a.id>$3::uuid)
         ORDER BY a.id LIMIT 26`,
        [query.replace(/[\\%_]/g, "\\$&"), query, after],
      );
      const items = rows.slice(0, 25);
      await this.audit.record(
        tx,
        actor,
        "identity.support_directory.read",
        actor,
        {
          returnedAccountIds: items.map((item) => item.id),
          count: items.length,
          olderPage: !!filters.after,
          hasMore: rows.length > 25,
          outcome: "success",
        },
      );
      return {
        items,
        nextCursor:
          rows.length > 25
            ? Buffer.from(JSON.stringify({ id: items[24].id, scope })).toString(
                "base64url",
              )
            : null,
      };
    });
  }
}
