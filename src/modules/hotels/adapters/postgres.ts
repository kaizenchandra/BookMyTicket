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
  PropertyStore,
  Property,
  Filters,
} from "../application/administration.ts";
import type { Content, State } from "../domain/property.ts";
export class PostgresProperties implements PropertyStore {
  constructor(private access: StaffAuthorization) {}
  run<T>(
    actor: string | null,
    permission: string,
    work: (tx: Transaction) => Promise<T>,
  ) {
    return transaction(async (tx) => {
      if (actor) {
        await this.access.requirePermission(tx, actor, "hotels.read");
        if (permission !== "hotels.read")
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
      "hotels:" + actor + ":" + key,
    ]);
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      previous = (
        await tx.query(
          "SELECT fingerprint,result FROM hotels.requests WHERE actor_id=$1 AND key=$2",
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
    await tx.query("INSERT INTO hotels.requests VALUES($1,$2,$3,$4)", [
      actor,
      key,
      fingerprint,
      result,
    ]);
    return result;
  }
  async get(tx: Transaction, id: string) {
    const row = (
      await tx.query(
        "SELECT id,code,content,state,version,created_at FROM hotels.properties WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Property not found.", 404);
    return row as Property;
  }
  async list(tx: Transaction, actor: string | null, f: Filters) {
    const { after, ...selection } = f,
      scope = pageScope(actor ?? "public", ["hotels", selection]),
      cursor = readPage(after, scope),
      q = f.q?.replace(/[\\%_]/g, "\\$&") ?? null;
    const rows = (
      await tx.query(
        `SELECT id,code,content,state,version,created_at,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM hotels.properties WHERE ($1::text IS NULL OR content->>'name' ILIKE '%'||$1||'%' OR code ILIKE '%'||$1||'%') AND ($2::text IS NULL OR lower(content->>'city')=lower($2)) AND ($3::text IS NULL OR content->>'kind'=$3) AND ($4::text IS NULL OR state=$4) AND ($5::numeric IS NULL OR latitude BETWEEN $5 AND $6 AND longitude BETWEEN $7 AND $8) AND ($9::timestamptz IS NULL OR (created_at,id)<($9,$10::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26`,
        [
          q,
          f.city ?? null,
          f.kind ?? null,
          actor ? (f.state ?? null) : "published",
          f.south ?? null,
          f.north ?? null,
          f.west ?? null,
          f.east ?? null,
          cursor?.time ?? null,
          cursor?.id ?? null,
        ],
      )
    ).rows;
    return {
      items: rows.slice(0, 25).map(({ page_time, ...r }) => r as Property),
      nextCursor: rows.length > 25 ? nextPage(rows[24], scope) : null,
    };
  }
  async create(tx: Transaction, code: string, c: Content) {
    const id = randomUUID(),
      r = await tx.query(
        "INSERT INTO hotels.properties(id,code,content,latitude,longitude) VALUES($1,$2,$3,$4,$5) ON CONFLICT(code) DO NOTHING RETURNING id",
        [id, code, c, c.latitude, c.longitude],
      );
    if (!r.rowCount)
      throw new AppError("DUPLICATE_PROPERTY", "Property code already exists.");
    return id;
  }
  async save(tx: Transaction, id: string, c: Content, state: State) {
    await tx.query(
      "UPDATE hotels.properties SET content=$2,state=$3,latitude=$4,longitude=$5,version=version+1,updated_at=clock_timestamp() WHERE id=$1",
      [id, c, state, c.latitude, c.longitude],
    );
  }
  async revision(
    tx: Transaction,
    p: Property,
    actor: string,
    action: string,
    reason: string,
  ) {
    await tx.query(
      "INSERT INTO hotels.revisions(property_id,version,actor_id,action,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6)",
      [p.id, p.version, actor, action, reason, p],
    );
  }
  async history(tx: Transaction, id: string, before?: number) {
    const rows = (
      await tx.query(
        "SELECT version,actor_id,action,reason,snapshot,created_at FROM hotels.revisions WHERE property_id=$1 AND ($2::integer IS NULL OR version<$2) ORDER BY version DESC LIMIT 26",
        [id, before ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 25),
      nextBefore: rows.length > 25 ? rows[24].version : null,
    };
  }
}
