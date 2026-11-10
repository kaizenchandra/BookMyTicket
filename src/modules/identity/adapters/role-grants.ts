import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export async function assignRoles(
  tx: Transaction,
  id: string,
  roles: string[],
) {
  const found = await tx.query(
    "SELECT id FROM identity.admin_roles WHERE id=ANY($1::uuid[]) AND (active OR EXISTS(SELECT 1 FROM identity.admin_role_assignments WHERE account_id=$2 AND role_id=identity.admin_roles.id)) FOR SHARE",
    [roles, id],
  );
  if (found.rowCount !== roles.length)
    throw new AppError("INVALID_ROLE", "Choose existing active roles.", 422);
  await tx.query(
    "DELETE FROM identity.admin_role_assignments WHERE account_id=$1",
    [id],
  );
  await tx.query(
    "INSERT INTO identity.admin_role_assignments SELECT $1,unnest($2::uuid[])",
    [id, roles],
  );
}
export async function refreshRoleGrants(tx: Transaction, id: string) {
  // Only remove grants that this projection created. Pre-existing/direct grants survive.
  await tx.query(
    "DELETE FROM identity.grants g USING identity.admin_role_grants r WHERE g.account_id=$1 AND r.account_id=g.account_id AND r.permission=g.permission AND g.scope='platform'",
    [id],
  );
  await tx.query(
    `WITH added AS (
 INSERT INTO identity.grants(account_id,permission,scope)
 SELECT DISTINCT $1::uuid,p.permission,'platform' FROM identity.admin_role_assignments a JOIN identity.admin_roles r ON r.id=a.role_id AND r.active JOIN identity.admin_role_permissions p ON p.role_id=r.id WHERE a.account_id=$1
 ON CONFLICT DO NOTHING RETURNING account_id,permission,scope)
 INSERT INTO identity.admin_role_grants SELECT account_id,permission,scope FROM added`,
    [id],
  );
}
