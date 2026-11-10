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
  TrainStore,
  TrainRecord,
  Filters,
} from "../application/administration.ts";
import type { Kind, Content } from "../domain/catalogue.ts";
export class PostgresTrains implements TrainStore {
  constructor(private access: StaffAuthorization) {}
  run<T>(actor: string, write: boolean, work: (tx: Transaction) => Promise<T>) {
    return transaction(async (tx) => {
      await this.access.requirePermission(tx, actor, "trains.read");
      if (write)
        await this.access.requirePermission(tx, actor, "trains.manage");
      return work(tx);
    });
  }
  async once<T>(
    tx: Transaction,
    actor: string,
    op: string,
    key: string,
    payload: unknown,
    work: () => Promise<T>,
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "trains:" + actor + ":" + op + ":" + key,
    ]);
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      previous = (
        await tx.query(
          "SELECT fingerprint,result FROM trains.requests WHERE actor_id=$1 AND operation=$2 AND key=$3",
          [actor, op, key],
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
    await tx.query("INSERT INTO trains.requests VALUES($1,$2,$3,$4,$5)", [
      actor,
      op,
      key,
      fingerprint,
      result,
    ]);
    return result;
  }
  async list(tx: Transaction, actor: string, kind: Kind, f: Filters) {
    const { after, ...selection } = f,
      scope = pageScope(actor, ["trains", kind, selection]),
      cursor = readPage(after, scope),
      q = f.q?.replace(/[\\%_]/g, "\\$&") ?? null;
    const rows = (
      await tx.query(
        `SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM trains.records WHERE kind=$1 AND ($2::text IS NULL OR content->>'name' ILIKE '%'||$2||'%' OR code ILIKE '%'||$2||'%' OR content->>'stationCode' ILIKE '%'||$2||'%') AND ($3::text IS NULL OR status=$3) AND ($4::text IS NULL OR content->>'trainNumber'=$4) AND ($5::text IS NULL OR content->>'routeId'=$5) AND ($6::timestamptz IS NULL OR (content->>'departure')::timestamptz >=$6) AND ($7::timestamptz IS NULL OR (content->>'departure')::timestamptz <$7) AND ($8::timestamptz IS NULL OR (created_at,id)<($8,$9::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26`,
        [
          kind,
          q,
          f.status ?? null,
          f.trainNumber ?? null,
          f.routeId?.toLowerCase() ?? null,
          f.from ?? null,
          f.until ?? null,
          cursor?.time ?? null,
          cursor?.id ?? null,
        ],
      )
    ).rows;
    return {
      items: rows.slice(0, 25).map(({ page_time, ...r }) => r as TrainRecord),
      nextCursor: rows.length > 25 ? nextPage(rows[24], scope) : null,
    };
  }
  async get(tx: Transaction, kind: Kind, id: string, write = false) {
    const r = (
      await tx.query(
        "SELECT * FROM trains.records WHERE kind=$1 AND id=$2 " +
          (write ? "FOR UPDATE" : "FOR SHARE"),
        [kind, id],
      )
    ).rows[0];
    if (!r)
      throw new AppError("NOT_FOUND", "Train catalogue record not found.", 404);
    return r as TrainRecord;
  }
  async create(
    tx: Transaction,
    kind: Kind,
    code: string,
    content: Content,
    status: string,
  ) {
    const id = randomUUID(),
      r = await tx.query(
        "INSERT INTO trains.records(id,kind,code,content,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id",
        [id, kind, code, content, status],
      );
    if (!r.rowCount)
      throw new AppError(
        "DUPLICATE_CODE",
        "This catalogue or station code is already registered.",
      );
    return id;
  }
  async update(tx: Transaction, id: string, content: Content, status: string) {
    await tx.query(
      "UPDATE trains.records SET content=$2,status=$3,version=version+1 WHERE id=$1",
      [id, content, status],
    );
  }
  async record(
    tx: Transaction,
    actor: string,
    action: string,
    reason: string,
    before: TrainRecord | null,
    after: TrainRecord,
  ) {
    await tx.query(
      "INSERT INTO trains.history(record_id,actor_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)",
      [after.id, actor, action, reason, before, after],
    );
  }
  async history(tx: Transaction, id: string, before?: string) {
    const rows = (
      await tx.query(
        "SELECT h.*,h.id::text FROM trains.history h WHERE record_id=$1 AND ($2::bigint IS NULL OR h.id<$2) ORDER BY h.id DESC LIMIT 26",
        [id, before ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 25),
      nextBefore: rows.length > 25 ? rows[24].id : null,
    };
  }
}
