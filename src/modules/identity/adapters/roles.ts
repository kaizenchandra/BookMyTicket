import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { AdminActivityReader } from "../../reporting/contracts/admin-history.ts";
import { randomUUID, createHash } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import { PostgresStaffAuthorization } from "./staff-authorization.ts";
import {
  pageScope,
  readPage,
  nextPage,
} from "../../../shared/admin-pagination.ts";
import { assignRoles, refreshRoleGrants } from "./role-grants.ts";
import type {
  RoleStore,
  RoleInput,
  RoleUpdate,
  AdminCreation,
} from "../application/roles.ts";
export class PostgresRoles implements RoleStore {
  constructor(
    private activityReader?: AdminActivityReader,
    private audit?: SecurityAudit,
  ) {}
  activity(actor: string, id: string, after?: string) {
    return this.run(actor, async (tx) => {
      if (
        !(
          await tx.query(
            "SELECT id FROM identity.accounts WHERE id=$1 UNION ALL SELECT id FROM identity.admin_roles WHERE id=$1",
            [id],
          )
        ).rowCount
      )
        throw new AppError("NOT_FOUND", "Account or role not found.", 404);
      const result = await this.activityReader!.read(tx, actor, id, after);
      await this.audit?.record(tx, actor, "identity.admin.activity.read", id, {
        outcome: "success",
      });
      return result;
    });
  }
  detail(actor: string, id: string) {
    return this.run(actor, async (tx) => {
      const result = await this.role(tx, id);
      await this.audit?.record(tx, actor, "identity.role.read", id, {
        outcome: "success",
      });
      return result;
    });
  }

  run<T>(actor: string, work: (tx: Transaction) => Promise<T>) {
    return transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(73312072)");
      await new PostgresStaffAuthorization().requirePermission(
        tx,
        actor,
        "access.manage",
      );
      return work(tx);
    });
  }
  async once<T>(
    tx: Transaction,
    actor: string,
    operation: string,
    key: string,
    payload: unknown,
    work: () => Promise<T>,
  ) {
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      existing = (
        await tx.query(
          "SELECT fingerprint,result FROM identity.admin_requests WHERE actor_id=$1 AND operation=$2 AND key=$3",
          [actor, operation, key],
        )
      ).rows[0];
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "This request key was used with different data.",
        );
      return existing.result as T;
    }
    const result = await work();
    await tx.query(
      "INSERT INTO identity.admin_requests(actor_id,operation,key,fingerprint,result) VALUES($1,$2,$3,$4,$5)",
      [actor, operation, key, fingerprint, result],
    );
    return result;
  }
  async role(tx: Transaction, id: string) {
    const r = await tx.query(
      "SELECT id,name,description,active,version FROM identity.admin_roles WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!r.rowCount) throw new AppError("NOT_FOUND", "Role not found.", 404);
    return {
      ...r.rows[0],
      permissions: (
        await tx.query(
          "SELECT permission FROM identity.admin_role_permissions WHERE role_id=$1 ORDER BY permission",
          [id],
        )
      ).rows.map((r) => r.permission),
    };
  }
  async unique(tx: Transaction, name: string, id?: string) {
    if (
      (
        await tx.query(
          "SELECT 1 FROM identity.admin_roles WHERE lower(name)=lower($1) AND ($2::uuid IS NULL OR id<>$2)",
          [name, id ?? null],
        )
      ).rowCount
    )
      throw new AppError(
        "DUPLICATE_ROLE",
        "A role with this name already exists.",
      );
  }
  async create(tx: Transaction, input: RoleInput) {
    await this.unique(tx, input.name);
    const id = randomUUID();
    await tx.query(
      "INSERT INTO identity.admin_roles(id,name,description) VALUES($1,$2,$3)",
      [id, input.name, input.description],
    );
    await tx.query(
      "INSERT INTO identity.admin_role_permissions SELECT $1,unnest($2::text[])",
      [id, input.permissions],
    );
    return id;
  }
  async members(tx: Transaction, id: string) {
    return (
      await tx.query(
        "SELECT account_id FROM identity.admin_role_assignments WHERE role_id=$1 ORDER BY account_id",
        [id],
      )
    ).rows.map((r) => r.account_id as string);
  }
  async update(tx: Transaction, id: string, input: RoleUpdate) {
    await this.unique(tx, input.name, id);
    await tx.query(
      "UPDATE identity.admin_roles SET name=$2,description=$3,active=$4,version=version+1 WHERE id=$1",
      [id, input.name, input.description, input.active],
    );
    await tx.query(
      "DELETE FROM identity.admin_role_permissions WHERE role_id=$1",
      [id],
    );
    await tx.query(
      "INSERT INTO identity.admin_role_permissions SELECT $1,unnest($2::text[])",
      [id, input.permissions],
    );
  }
  async refresh(tx: Transaction, ids: string[]) {
    for (const id of ids) {
      await tx.query(
        "UPDATE identity.accounts SET admin_version=admin_version+1 WHERE id=$1",
        [id],
      );
      await refreshRoleGrants(tx, id);
      await tx.query("DELETE FROM identity.sessions WHERE account_id=$1", [id]);
    }
    if (
      !(
        await tx.query(
          "SELECT 1 FROM identity.accounts a JOIN identity.grants g ON g.account_id=a.id WHERE a.status='active' AND g.permission='access.manage' AND g.scope='platform' LIMIT 1",
        )
      ).rowCount
    )
      throw new AppError(
        "LAST_ADMIN",
        "At least one active access administrator must remain.",
      );
  }
  async createAccount(tx: Transaction, input: AdminCreation) {
    const id = randomUUID();
    const added = await tx.query(
      "INSERT INTO identity.accounts(id,contact,admin_name,is_admin) VALUES($1,$2,$3,true) ON CONFLICT(contact) DO NOTHING RETURNING id",
      [id, input.contact, input.name],
    );
    if (!added.rowCount)
      throw new AppError(
        "ACCOUNT_EXISTS",
        "An account with this contact already exists. Find and manage that account explicitly.",
      );
    await tx.query(
      "INSERT INTO identity.grants SELECT $1,unnest($2::text[]),'platform'",
      [id, input.permissions],
    );
    await assignRoles(tx, id, input.roles);
    await refreshRoleGrants(tx, id);
    return { id };
  }
  list(
    actor: string,
    f: {
      q?: string;
      active?: string;
      after?: string;
      sort?: "newest" | "oldest";
    },
  ) {
    return this.run(actor, async (tx) => {
      const scope = pageScope(actor, [
          f.q ?? null,
          f.active ?? null,
          f.sort ?? "newest",
        ]),
        cursor = readPage(f.after, scope);
      const r = await tx.query(
        `SELECT r.id,r.name,r.description,r.active,r.version,r.created_at,ARRAY(SELECT permission FROM identity.admin_role_permissions WHERE role_id=r.id ORDER BY permission) AS permissions,(SELECT count(*)::text FROM identity.admin_role_assignments WHERE role_id=r.id) AS members,to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM identity.admin_roles r WHERE ($1::text IS NULL OR r.name ILIKE '%'||$1||'%' ESCAPE '\\') AND ($2::boolean IS NULL OR r.active=$2) AND ($3::timestamptz IS NULL OR (r.created_at,r.id)${f.sort === "oldest" ? ">" : "<"}($3,$4::uuid)) ORDER BY r.created_at ${f.sort === "oldest" ? "ASC" : "DESC"},r.id ${f.sort === "oldest" ? "ASC" : "DESC"} LIMIT 26`,
        [
          f.q?.replace(/[\\%_]/g, "\\$&") ?? null,
          f.active ?? null,
          cursor?.time ?? null,
          cursor?.id ?? null,
        ],
      );
      await this.audit?.record(tx, actor, "identity.roles.read", "directory", {
        outcome: "success",
        count: Math.min(r.rows.length, 25),
      });
      return {
        items: r.rows.slice(0, 25).map(({ page_time, ...x }) => x),
        nextCursor: r.rows.length > 25 ? nextPage(r.rows[24], scope) : null,
      };
    });
  }
}
