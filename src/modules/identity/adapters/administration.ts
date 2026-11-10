import { assignRoles, refreshRoleGrants } from "./role-grants.ts";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import {
  pageScope,
  readPage,
  nextPage,
} from "../../../shared/admin-pagination.ts";
import {
  adminPermissions,
  type AccountAdministrationStore,
  type AccountChange,
} from "../application/administration.ts";
import { PostgresStaffAuthorization } from "./staff-authorization.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
export class PostgresAccountAdministration implements AccountAdministrationStore {
  constructor(private customerScope = false) {}
  transaction = transaction;
  async lock(tx: Transaction) {
    await tx.query("SELECT pg_advisory_xact_lock(73312072)");
  }
  async authorize(tx: Transaction, actor: string) {
    if (this.customerScope)
      await new PostgresStaffAuthorization().requirePermission(
        tx,
        actor,
        "customers.read",
      );
    await new PostgresStaffAuthorization().requirePermission(
      tx,
      actor,
      "access.manage",
    );
  }
  async get(tx: Transaction, id: string) {
    const result = await tx.query(
      'SELECT id,status,customer_flags AS "customerFlags",admin_name AS name,admin_version AS version FROM identity.accounts WHERE id=$1 FOR UPDATE',
      [id],
    );
    if (!result.rowCount)
      throw new AppError("NOT_FOUND", "Account not found.", 404);
    const grants = await tx.query(
      "SELECT permission FROM identity.grants WHERE account_id=$1 AND scope='platform' ORDER BY permission",
      [id],
    );
    return {
      ...result.rows[0],
      permissions: grants.rows.map((r) => r.permission),
      directPermissions: (
        await tx.query(
          "SELECT permission FROM identity.grants g WHERE account_id=$1 AND scope='platform' AND NOT EXISTS(SELECT 1 FROM identity.admin_role_grants r WHERE r.account_id=g.account_id AND r.permission=g.permission) ORDER BY permission",
          [id],
        )
      ).rows.map((r) => r.permission),
      roles: (
        await tx.query(
          "SELECT role_id FROM identity.admin_role_assignments WHERE account_id=$1 ORDER BY role_id",
          [id],
        )
      ).rows.map((r) => r.role_id),
    };
  }
  async otherManagers(tx: Transaction, id: string) {
    return Number(
      (
        await tx.query(
          "SELECT count(*) FROM identity.accounts a JOIN identity.grants g ON g.account_id=a.id WHERE a.status='active' AND g.permission='access.manage' AND g.scope='platform' AND a.id<>$1",
          [id],
        )
      ).rows[0].count,
    );
  }
  async update(tx: Transaction, id: string, change: AccountChange) {
    await tx.query(
      "UPDATE identity.accounts SET status=coalesce($2,status),admin_name=coalesce($3,admin_name),is_admin=is_admin OR $4,customer_flags=coalesce($5,customer_flags),admin_version=admin_version+1 WHERE id=$1",
      [
        id,
        change.status ?? null,
        change.name ?? null,
        change.permissions !== undefined ||
          change.roles !== undefined ||
          change.name !== undefined,
        change.customerFlags ?? null,
      ],
    );
    if (change.permissions) {
      await tx.query(
        "DELETE FROM identity.grants WHERE account_id=$1 AND scope='platform' AND permission=ANY($2::text[])",
        [id, adminPermissions],
      );
      await tx.query(
        "INSERT INTO identity.grants(account_id,permission,scope) SELECT $1,unnest($2::text[]),'platform'",
        [id, change.permissions],
      );
    }
    if (change.roles) await assignRoles(tx, id, change.roles);
    await refreshRoleGrants(tx, id);
    await tx.query("DELETE FROM identity.sessions WHERE account_id=$1", [id]);
  }
}
export class AdminDirectory {
  constructor(private audit: SecurityAudit) {}
  async detail(actor: string, id: string) {
    return transaction(async (tx) => {
      await new PostgresStaffAuthorization().requirePermission(
        tx,
        actor,
        "access.manage",
      );
      const result = await tx.query(
        `SELECT a.id,a.status,a.admin_name AS name,a.admin_version AS version,a.created_at,
    CASE WHEN position('@' in a.contact)>0 THEN left(a.contact,1)||'***@'||split_part(a.contact,'@',2) ELSE '***'||right(a.contact,4) END AS contact,
    ARRAY(SELECT permission FROM identity.grants WHERE account_id=a.id AND scope='platform' ORDER BY permission) AS permissions,
    ARRAY(SELECT permission FROM identity.grants g WHERE account_id=a.id AND scope='platform' AND NOT EXISTS(SELECT 1 FROM identity.admin_role_grants r WHERE r.account_id=g.account_id AND r.permission=g.permission) ORDER BY permission) AS "directPermissions",
    ARRAY(SELECT role_id FROM identity.admin_role_assignments WHERE account_id=a.id ORDER BY role_id) AS roles,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'description',r.description,'active',r.active,'version',r.version,'permissions',ARRAY(SELECT permission FROM identity.admin_role_permissions WHERE role_id=r.id ORDER BY permission)) ORDER BY r.name,r.id),'[]'::jsonb) FROM identity.admin_roles r JOIN identity.admin_role_assignments assignment ON assignment.role_id=r.id WHERE assignment.account_id=a.id) AS "roleDefinitions"
    FROM identity.accounts a WHERE a.id=$1`,
        [id],
      );
      if (!result.rowCount)
        throw new AppError(
          "NOT_FOUND",
          "Administrator account not found.",
          404,
        );
      await this.audit.record(
        tx,
        actor,
        "identity.admin.read",
        result.rows[0].id,
        { outcome: "success" },
      );
      return result.rows[0];
    });
  }
  async capabilities(actor: string) {
    return transaction(async (tx) => {
      const result = await tx.query(
        "SELECT permission FROM identity.grants g JOIN identity.accounts a ON a.id=g.account_id WHERE a.id=$1 AND a.status='active' AND g.scope='platform' ORDER BY permission",
        [actor],
      );
      return { permissions: result.rows.map((r) => r.permission) as string[] };
    });
  }
  async list(
    actor: string,
    staff: boolean,
    f: {
      id?: string;
      contact?: string;
      status?: string;
      after?: string;
      q?: string;
      role?: string;
      permission?: string;
      sort?: "newest" | "oldest";
    },
  ) {
    return transaction(async (tx) => {
      await new PostgresStaffAuthorization().requirePermission(
        tx,
        actor,
        staff ? "access.manage" : "customers.read",
      );
      const scope = pageScope(actor, [
          staff,
          f.id ?? null,
          f.contact ?? null,
          f.status ?? null,
          f.q ?? null,
          f.role ?? null,
          f.permission ?? null,
          f.sort ?? "newest",
        ]),
        cursor = readPage(f.after, scope);
      const result = await tx.query(
        `SELECT a.id,a.status,a.admin_name AS name,a.admin_version AS version,a.created_at,
   CASE WHEN position('@' in a.contact)>0 THEN left(a.contact,1)||'***@'||split_part(a.contact,'@',2) ELSE '***'||right(a.contact,4) END AS contact,
   ARRAY(SELECT permission FROM identity.grants WHERE account_id=a.id AND scope='platform' ORDER BY permission) AS permissions,
   ARRAY(SELECT permission FROM identity.grants g WHERE account_id=a.id AND scope='platform' AND NOT EXISTS(SELECT 1 FROM identity.admin_role_grants r WHERE r.account_id=g.account_id AND r.permission=g.permission) ORDER BY permission) AS "directPermissions",
   ARRAY(SELECT role_id FROM identity.admin_role_assignments WHERE account_id=a.id ORDER BY role_id) AS roles,
   to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
   FROM identity.accounts a WHERE ($1::uuid IS NULL OR a.id=$1) AND ($2::text IS NULL OR lower(a.contact)=lower($2)) AND ($3::text IS NULL OR a.status=$3)
   AND (NOT $4::boolean OR a.is_admin OR $1::uuid IS NOT NULL OR $2::text IS NOT NULL OR EXISTS(SELECT 1 FROM identity.grants WHERE account_id=a.id AND scope='platform'))
   AND ($5::timestamptz IS NULL OR (a.created_at,a.id)${f.sort === "oldest" ? ">" : "<"}($5,$6::uuid)) AND ($7::text IS NULL OR a.admin_name ILIKE '%'||$7||'%')
   AND ($8::uuid IS NULL OR EXISTS(SELECT 1 FROM identity.admin_role_assignments WHERE account_id=a.id AND role_id=$8))
   AND ($9::text IS NULL OR EXISTS(SELECT 1 FROM identity.grants WHERE account_id=a.id AND scope='platform' AND permission=$9))
   ORDER BY a.created_at ${f.sort === "oldest" ? "ASC" : "DESC"},a.id ${f.sort === "oldest" ? "ASC" : "DESC"} LIMIT 26`,
        [
          f.id ?? null,
          f.contact ?? null,
          f.status ?? null,
          staff,
          cursor?.time ?? null,
          cursor?.id ?? null,
          f.q?.replace(/[\\%_]/g, "\\$&") ?? null,
          f.role ?? null,
          f.permission ?? null,
        ],
      );
      await this.audit.record(
        tx,
        actor,
        "identity.directory.read",
        staff ? "staff" : "customers",
        { count: Math.min(result.rows.length, 25), outcome: "success" },
      );
      return {
        items: result.rows
          .slice(0, 25)
          .map(
            ({ page_time, permissions, directPermissions, roles, ...r }) => ({
              ...r,
              ...(staff ? { permissions, directPermissions, roles } : {}),
            }),
          ),
        nextCursor:
          result.rows.length > 25 ? nextPage(result.rows[24], scope) : null,
      };
    });
  }
}
