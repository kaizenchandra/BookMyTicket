import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  ExportInput,
  ExportSources,
  ExportStore,
} from "../application/exports.ts";
import type { SecurityAudit } from "../contracts/index.ts";
import { csvRow } from "../domain/csv.ts";
const columns =
  "id,occurrence_id,form_id,fields,purpose,state,attempts,error_code,row_count,created_at,generated_at,expires_at";
export class PostgresExports implements ExportStore {
  constructor(
    private source: ExportSources,
    private audit: SecurityAudit,
  ) {}
  private key() {
    const k = process.env.EXPORT_ENCRYPTION_KEY;
    if (!k || !/^[a-f0-9]{64}$/i.test(k))
      throw new AppError(
        "EXPORT_UNAVAILABLE",
        "Secure export storage is not configured.",
        503,
      );
    return Buffer.from(k, "hex");
  }
  private encrypt(text: string, id: string, actor: string) {
    const nonce = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key(), nonce);
    cipher.setAAD(Buffer.from(`${id}:${actor}`));
    const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return [nonce, cipher.getAuthTag(), body]
      .map((b) => b.toString("base64"))
      .join(".");
  }
  private decrypt(text: string, id: string, actor: string) {
    const [nonce, tag, body] = text
      .split(".")
      .map((b) => Buffer.from(b, "base64"));
    const cipher = createDecipheriv("aes-256-gcm", this.key(), nonce!);
    cipher.setAAD(Buffer.from(`${id}:${actor}`));
    cipher.setAuthTag(tag!);
    return Buffer.concat([cipher.update(body!), cipher.final()]).toString(
      "utf8",
    );
  }
  private async fields(
    tx: Transaction,
    input: { occurrenceId: string; formId: string; fields: string[] },
  ) {
    const definitions = await this.source.fields(
      tx,
      input.occurrenceId,
      input.formId,
    );
    if (input.fields.some((id) => !definitions.some((f) => f.id === id)))
      throw new AppError(
        "INVALID_EXPORT_FIELD",
        "Select fields from the requested form version.",
        422,
      );
    return input.fields.map((id) => definitions.find((f) => f.id === id)!);
  }
  request(actor: string, key: string, input: ExportInput) {
    return transaction(async (tx) => {
      await this.source.authorize(tx, actor, input.occurrenceId);
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,14))", [
        actor,
      ]);
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
      const previous = (
        await tx.query(
          `SELECT ${columns},fingerprint FROM reporting.attendee_exports WHERE actor_id=$1 AND operation_key=$2`,
          [actor, key],
        )
      ).rows[0];
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "This export key was used with different scope.",
            409,
          );
        delete previous.fingerprint;
        return previous;
      }
      this.key();
      await this.fields(tx, input);
      const count = (
        await tx.query(
          "SELECT count(*)::int AS n FROM reporting.attendee_exports WHERE actor_id=$1 AND state='queued' AND expires_at>clock_timestamp()",
          [actor],
        )
      ).rows[0].n;
      if (count >= 5)
        throw new AppError(
          "EXPORT_LIMIT",
          "Wait for pending exports before requesting another.",
          429,
        );
      const id = randomUUID();
      const row = (
        await tx.query(
          `INSERT INTO reporting.attendee_exports(id,actor_id,occurrence_id,form_id,fields,purpose,operation_key,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${columns}`,
          [
            id,
            actor,
            input.occurrenceId,
            input.formId,
            JSON.stringify(input.fields),
            input.purpose,
            key,
            fingerprint,
          ],
        )
      ).rows[0];
      await this.audit.record(tx, actor, "attendee_export.requested", id, {
        occurrenceId: input.occurrenceId,
        formId: input.formId,
        fields: input.fields,
      });
      return row;
    });
  }
  list(actor: string, occurrence: string) {
    return transaction(async (tx) => {
      await this.source.authorize(tx, actor, occurrence);
      return {
        items: (
          await tx.query(
            `SELECT ${columns},clock_timestamp() AS server_time FROM reporting.attendee_exports WHERE actor_id=$1 AND occurrence_id=$2 ORDER BY created_at DESC,id DESC LIMIT 30`,
            [actor, occurrence],
          )
        ).rows.map((r) => ({
          ...r,
          state:
            new Date(r.expires_at) <= new Date(r.server_time)
              ? "expired"
              : r.state,
        })),
      };
    });
  }
  download(actor: string, id: string) {
    return transaction(async (tx) => {
      await tx.query("SET LOCAL lock_timeout='3s'");
      const row = (
        await tx.query(
          "SELECT *,expires_at<=clock_timestamp() AS expired FROM reporting.attendee_exports WHERE id=$1 AND actor_id=$2 FOR SHARE",
          [id, actor],
        )
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Export not found.", 404);
      await this.source.authorize(tx, actor, row.occurrence_id);
      if (
        (
          await tx.query(
            "SELECT expires_at<=clock_timestamp() AS expired FROM reporting.attendee_exports WHERE id=$1",
            [id],
          )
        ).rows[0].expired
      )
        throw new AppError(
          "EXPORT_EXPIRED",
          "This export has expired. Request a new export.",
          410,
        );
      if (row.state !== "ready")
        throw new AppError(
          "EXPORT_NOT_READY",
          "The export is not ready for download.",
          409,
        );
      const csv = this.decrypt(row.artifact, id, actor);
      await this.audit.record(tx, actor, "attendee_export.downloaded", id, {
        rowCount: row.row_count,
      });
      return csv;
    });
  }
  once() {
    return transaction(async (tx) => {
      await tx.query("SET LOCAL lock_timeout='3s'");
      await tx.query("SET LOCAL statement_timeout='10s'");
      await tx.query(
        "UPDATE reporting.attendee_exports SET state='expired',artifact=NULL WHERE id IN (SELECT id FROM reporting.attendee_exports WHERE expires_at<=clock_timestamp() AND state<>'expired' ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)",
      );
      const row = (
        await tx.query(
          "SELECT * FROM reporting.attendee_exports WHERE state='queued' AND next_attempt_at<=clock_timestamp() AND expires_at>clock_timestamp() ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",
        )
      ).rows[0];
      if (!row) return false;
      await tx.query("SAVEPOINT export_work");
      try {
        await this.source.authorize(tx, row.actor_id, row.occurrence_id);
        const fields = await this.fields(tx, {
          occurrenceId: row.occurrence_id,
          formId: row.form_id,
          fields: row.fields,
        });
        const registrations = await this.source.rows(
          tx,
          row.occurrence_id,
          row.form_id,
        );
        let csv = csvRow([
            "Order reference",
            "Attendee",
            ...fields.map((f) => f.label),
          ]),
          count = 0,
          bytes = Buffer.byteLength(csv);
        for (const registration of registrations)
          for (const [index, answers] of registration.answers.entries()) {
            const line = csvRow([
              registration.orderId,
              index + 1,
              ...fields.map((f) => answers[f.id] ?? ""),
            ]);
            bytes += Buffer.byteLength(line);
            if (bytes > 2 * 1024 * 1024)
              throw new AppError(
                "EXPORT_TOO_LARGE",
                "Narrow this export scope.",
                422,
              );
            csv += line;
            count++;
          }
        const artifact = this.encrypt(csv, row.id, row.actor_id);
        await tx.query(
          "UPDATE reporting.attendee_exports SET state='ready',artifact=$2,row_count=$3,generated_at=clock_timestamp(),attempts=attempts+1,error_code=NULL WHERE id=$1",
          [row.id, artifact, count],
        );
        await this.audit.record(
          tx,
          row.actor_id,
          "attendee_export.generated",
          row.id,
          { rowCount: count },
        );
      } catch (error) {
        await tx.query("ROLLBACK TO SAVEPOINT export_work");
        const code =
          error instanceof AppError ? error.code : "EXPORT_PROCESSING_FAILED";
        const terminal =
          [
            "FORBIDDEN",
            "PROVIDER_NOT_APPROVED",
            "NOT_FOUND",
            "INVALID_EXPORT_FIELD",
            "EXPORT_TOO_LARGE",
          ].includes(code) || row.attempts >= 2;
        await tx.query(
          "UPDATE reporting.attendee_exports SET attempts=attempts+1,state=$2,error_code=$3,next_attempt_at=clock_timestamp()+interval '30 seconds' WHERE id=$1",
          [row.id, terminal ? "failed" : "queued", code],
        );
        await this.audit.record(
          tx,
          row.actor_id,
          "attendee_export.attempt_failed",
          row.id,
          { code, terminal },
        );
      }
      return true;
    });
  }
}
