import { randomUUID, createHash } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import {
  pageScope,
  readPage,
  nextPage,
} from "../../../shared/admin-pagination.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import type {
  PackageStore,
  PackageRecord,
  Filters,
} from "../application/administration.ts";
import type { Definition } from "../domain/package.ts";
export class PostgresPackages implements PackageStore {
  constructor(private access: StaffAuthorization) {}
  run<T>(
    actor: string | null,
    permission: string,
    work: (tx: Transaction) => Promise<T>,
  ) {
    return transaction(async (tx) => {
      if (actor) {
        await this.access.requirePermission(tx, actor, "packages.read");
        if (permission !== "packages.read")
          await this.access.requirePermission(tx, actor, permission);
      }
      return work(tx);
    });
  }
  async once<T>(
    tx: Transaction,
    actor: string,
    key: string,
    payload: unknown,
    work: () => Promise<T>,
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "packages:" + actor + ":" + key,
    ]);
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      previous = (
        await tx.query(
          "SELECT fingerprint,result FROM packages.requests WHERE actor_id=$1 AND key=$2",
          [actor, key],
        )
      ).rows[0];
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "Request key already used with different data.",
        );
      return previous.result as T;
    }
    const result = await work();
    await tx.query("INSERT INTO packages.requests VALUES($1,$2,$3,$4)", [
      actor,
      key,
      fingerprint,
      result,
    ]);
    return result;
  }
  async get(tx: Transaction, id: string) {
    const r = (
      await tx.query(
        "SELECT * FROM packages.definitions WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!r) throw new AppError("NOT_FOUND", "Package not found.", 404);
    return r as PackageRecord;
  }
  async list(tx: Transaction, actor: string | null, f: Filters) {
    const { after, ...selection } = f,
      scope = pageScope(actor ?? "public", ["packages", selection]),
      cursor = readPage(after, scope),
      rows = (
        await tx.query(
          `SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM packages.definitions WHERE ($1::text IS NULL OR content->>'name' ILIKE '%'||$1||'%' OR code ILIKE '%'||$1||'%') AND ($2::text IS NULL OR state=$2) AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(content->'destinations') d WHERE lower(d)=lower($3))) AND ($4::timestamptz IS NULL OR (created_at,id)<($4,$5::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26`,
          [
            f.q?.replace(/[\\%_]/g, "\\$&") ?? null,
            actor ? (f.state ?? null) : "published",
            f.destination ?? null,
            cursor?.time ?? null,
            cursor?.id ?? null,
          ],
        )
      ).rows;
    return {
      items: rows.slice(0, 25).map(({ page_time, ...r }) => r as PackageRecord),
      nextCursor: rows.length > 25 ? nextPage(rows[24], scope) : null,
    };
  }
  async create(tx: Transaction, code: string, c: Definition) {
    const id = randomUUID(),
      r = await tx.query(
        "INSERT INTO packages.definitions(id,code,content) VALUES($1,$2,$3) ON CONFLICT(code) DO NOTHING RETURNING id",
        [id, code, c],
      );
    if (!r.rowCount)
      throw new AppError("DUPLICATE_PACKAGE", "Package code already exists.");
    return id;
  }
  async save(tx: Transaction, id: string, c: Definition, state: string) {
    await tx.query(
      "UPDATE packages.definitions SET content=$2,state=$3,version=version+1 WHERE id=$1",
      [id, c, state],
    );
  }
  async record(
    tx: Transaction,
    actor: string,
    p: PackageRecord,
    action: string,
    reason: string,
  ) {
    await tx.query(
      "INSERT INTO packages.history(package_id,actor_id,action,reason,snapshot) VALUES($1,$2,$3,$4,$5)",
      [p.id, actor, action, reason, p],
    );
  }
  async history(tx: Transaction, id: string, before?: string) {
    const rows = (
      await tx.query(
        "SELECT h.*,h.id::text FROM packages.history h WHERE package_id=$1 AND ($2::bigint IS NULL OR h.id<$2) ORDER BY h.id DESC LIMIT 26",
        [id, before ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 25),
      nextBefore: rows.length > 25 ? rows[24].id : null,
    };
  }
  async today(tx: Transaction) {
    return (
      await tx.query(
        "SELECT to_char(clock_timestamp() AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS today",
      )
    ).rows[0].today as string;
  }
}
