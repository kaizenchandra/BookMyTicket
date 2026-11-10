import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import {
  pageScope,
  readPage,
  nextPage,
} from "../../../shared/admin-pagination.ts";
import type { CustomerFilters } from "../../../shared/customer-admin.ts";
import type { CustomerStore } from "../application/customer-admin.ts";
import { PostgresStaffAuthorization } from "./staff-authorization.ts";
const fields = `a.id,a.status,a.created_at,a.admin_version AS version,a.customer_flags AS flags,a.contact_verified_at,
 CASE WHEN a.contact_verified_at IS NOT NULL THEN 'verified' WHEN EXISTS(SELECT 1 FROM identity.challenges c WHERE c.contact=a.contact AND c.consumed) THEN 'verified_legacy' ELSE 'not_recorded' END AS contact_verification,
 CASE WHEN position('@' in a.contact)>0 THEN left(a.contact,1)||'***@'||split_part(a.contact,'@',2) ELSE '***'||right(a.contact,4) END AS contact`;
export class PostgresCustomerAdministration implements CustomerStore {
  private access = new PostgresStaffAuthorization();
  run<T>(actor: string, work: (tx: Transaction) => Promise<T>) {
    return transaction(async (tx) => {
      await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await this.access.requirePermission(tx, actor, "customers.read");
      return work(tx);
    });
  }
  require(tx: Transaction, actor: string, p: string) {
    return this.access.requirePermission(tx, actor, p);
  }
  async permissions(tx: Transaction, actor: string) {
    return {
      bookings: await this.access.hasPermission(tx, actor, "bookings.read"),
      payments: await this.access.hasPermission(tx, actor, "finance"),
      support: await this.access.hasPermission(tx, actor, "support"),
      manage: await this.access.hasPermission(tx, actor, "access.manage"),
    };
  }
  async get(tx: Transaction, id: string) {
    const r = await tx.query(
      `SELECT ${fields} FROM identity.accounts a WHERE a.id=$1`,
      [id],
    );
    if (!r.rowCount)
      throw new AppError("NOT_FOUND", "Customer not found.", 404);
    return r.rows[0];
  }
  async list(
    tx: Transaction,
    actor: string,
    f: CustomerFilters,
    owners: string[] | null,
    names: string[] | null,
  ) {
    const { after, ...selection } = f,
      scope = pageScope(actor, selection),
      cursor = readPage(after, scope),
      asc = f.sort === "oldest";
    const r = await tx.query(
      `SELECT ${fields},to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM identity.accounts a
 WHERE ($1::uuid IS NULL OR a.id=$1) AND ($2::text IS NULL OR lower(a.contact)=lower($2)) AND ($3::text IS NULL OR a.status=$3)
 AND ($4::timestamptz IS NULL OR a.created_at >= $4) AND ($5::timestamptz IS NULL OR a.created_at < $5)
 AND ($6::uuid[] IS NULL OR ${f.activity === "no_bookings" ? "NOT " : ""}a.id=ANY($6)) AND ($7::uuid[] IS NULL OR a.id=ANY($7))
 AND ($8::timestamptz IS NULL OR (a.created_at,a.id)${asc ? ">" : "<"}($8,$9::uuid)) ORDER BY a.created_at ${asc ? "ASC" : "DESC"},a.id ${asc ? "ASC" : "DESC"} LIMIT 26`,
      [
        f.id ?? null,
        f.contact ?? null,
        f.status ?? null,
        f.from ?? null,
        f.until ?? null,
        owners,
        names,
        cursor?.time ?? null,
        cursor?.id ?? null,
      ],
    );
    return {
      items: r.rows.slice(0, 25).map(({ page_time, ...row }) => row),
      nextCursor: r.rows.length > 25 ? nextPage(r.rows[24], scope) : null,
    };
  }
}
