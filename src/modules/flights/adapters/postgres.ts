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
  FlightStore,
  SupplierInput,
  Supplier,
  Filters,
} from "../application/administration.ts";
import type { CommercialRule } from "../domain/commercial.ts";
const columns =
  'id,code,name,airline_codes AS "airlineCodes",environment,status,version,created_at';
export class PostgresFlights implements FlightStore {
  constructor(private access: StaffAuthorization) {}
  run<T>(
    actor: string,
    permission: string,
    work: (tx: Transaction) => Promise<T>,
  ) {
    return transaction(async (tx) => {
      await this.access.requirePermission(tx, actor, "flights.read");
      if (permission !== "flights.read")
        await this.access.requirePermission(tx, actor, permission);
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
      "flights:" + actor + ":" + key,
    ]);
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      previous = (
        await tx.query(
          "SELECT fingerprint,result FROM flights.requests WHERE actor_id=$1 AND key=$2",
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
    await tx.query("INSERT INTO flights.requests VALUES($1,$2,$3,$4)", [
      actor,
      key,
      fingerprint,
      result,
    ]);
    return result;
  }
  async list(tx: Transaction, actor: string, f: Filters) {
    const { after, ...filters } = f,
      scope = pageScope(actor, ["flights", filters]),
      cursor = readPage(after, scope),
      q = f.q?.replace(/[\\%_]/g, "\\$&") ?? null;
    const rows = (
      await tx.query(
        `SELECT ${columns},to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM flights.suppliers WHERE ($1::text IS NULL OR name ILIKE '%'||$1||'%' OR code ILIKE '%'||$1||'%') AND ($2::text IS NULL OR status=$2) AND ($3::timestamptz IS NULL OR (created_at,id)<($3,$4::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26`,
        [q, f.status ?? null, cursor?.time ?? null, cursor?.id ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 25).map(({ page_time, ...r }) => r as Supplier),
      nextCursor: rows.length > 25 ? nextPage(rows[24], scope) : null,
    };
  }
  async get(tx: Transaction, id: string) {
    const row = (
      await tx.query(
        `SELECT ${columns} FROM flights.suppliers WHERE id=$1 FOR UPDATE`,
        [id],
      )
    ).rows[0];
    if (!row)
      throw new AppError("NOT_FOUND", "Flight supplier not found.", 404);
    return row as Supplier;
  }
  async create(tx: Transaction, input: SupplierInput) {
    const id = randomUUID();
    const inserted = await tx.query(
      "INSERT INTO flights.suppliers(id,code,name,airline_codes,environment) VALUES($1,$2,$3,$4,$5) ON CONFLICT(code) DO NOTHING RETURNING id",
      [id, input.code, input.name, input.airlineCodes, input.environment],
    );
    if (!inserted.rowCount)
      throw new AppError(
        "DUPLICATE_SUPPLIER",
        "Supplier code is already registered.",
      );
    return id;
  }
  async update(
    tx: Transaction,
    id: string,
    input: SupplierInput & { status: "draft" | "suspended" },
  ) {
    const existing = await this.get(tx, id);
    if (existing.code !== input.code)
      throw new AppError("IMMUTABLE_CODE", "Supplier code cannot be changed.");
    await tx.query(
      "UPDATE flights.suppliers SET name=$2,airline_codes=$3,environment=$4,status=$5,version=version+1 WHERE id=$1",
      [id, input.name, input.airlineCodes, input.environment, input.status],
    );
  }
  async rule(tx: Transaction, id: string) {
    return (
      ((
        await tx.query(
          "SELECT version,markup_bps,service_fee_paise::text FROM flights.commercial_rules WHERE supplier_id=$1",
          [id],
        )
      ).rows[0] as CommercialRule | undefined) ?? null
    );
  }
  async saveRule(tx: Transaction, id: string, bps: number, fee: string) {
    await tx.query(
      "INSERT INTO flights.commercial_rules(supplier_id,markup_bps,service_fee_paise) VALUES($1,$2,$3) ON CONFLICT(supplier_id) DO UPDATE SET markup_bps=$2,service_fee_paise=$3,version=flights.commercial_rules.version+1,updated_at=clock_timestamp()",
      [id, bps, fee],
    );
  }
}
