import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { pool, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  AcceptedRegistration,
  RegistrationInput,
} from "../../events/contracts/index.ts";
import type { RegistrationReport } from "../contracts/registrations.ts";
export class PostgresRegistrations implements RegistrationReport {
  private key() {
    const key = process.env.REGISTRATION_ENCRYPTION_KEY;
    if (!key || !/^[a-f0-9]{64}$/i.test(key))
      throw new AppError(
        "REGISTRATION_UNAVAILABLE",
        "Secure registration storage is not configured.",
        503,
      );
    return Buffer.from(key, "hex");
  }
  fingerprint(input?: RegistrationInput) {
    if (!input) return undefined;
    const canonical = {
      formId: input.formId,
      answers: input.answers.map((a) =>
        Object.fromEntries(
          Object.entries(a).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    };
    return createHmac("sha256", this.key())
      .update(JSON.stringify(canonical))
      .digest("hex");
  }
  async save(
    tx: Transaction,
    orderId: string,
    ownerId: string,
    registration: AcceptedRegistration,
    digest: string,
  ) {
    const nonce = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key(), nonce);
    cipher.setAAD(Buffer.from(orderId + ":" + ownerId));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(registration.answers), "utf8"),
      cipher.final(),
    ]);
    const payload = [nonce, cipher.getAuthTag(), encrypted]
      .map((b) => b.toString("base64"))
      .join(".");
    await tx.query(
      "INSERT INTO bookings.registrations(order_id,owner_id,form_id,form_snapshot,answers_ciphertext,input_digest) VALUES($1,$2,$3,$4,$5,$6)",
      [
        orderId,
        ownerId,
        registration.form.id,
        registration.form,
        payload,
        digest,
      ],
    );
  }
  private decrypt(
    ciphertext: string,
    orderId: string,
    ownerId: string,
  ): Record<string, string | boolean>[] {
    const [nonce, tag, body] = ciphertext
      .split(".")
      .map((s: string) => Buffer.from(s, "base64"));
    const cipher = createDecipheriv("aes-256-gcm", this.key(), nonce);
    cipher.setAAD(Buffer.from(orderId + ":" + ownerId));
    cipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8"),
    );
  }
  async confirmed(tx: Transaction, occurrence: string, form: string) {
    const rows = (
      await tx.query(
        "SELECT o.id,r.owner_id,r.answers_ciphertext FROM bookings.orders o JOIN bookings.registrations r ON r.order_id=o.id WHERE o.state='confirmed' AND r.form_id=$1 AND o.snapshot @> $2::jsonb ORDER BY o.id LIMIT 1001",
        [form, JSON.stringify({ occurrences: [{ id: occurrence }] })],
      )
    ).rows;
    if (rows.length > 1000)
      throw new AppError(
        "EXPORT_TOO_LARGE",
        "This export exceeds 1,000 registrations. Narrow the scope.",
        422,
      );
    return rows.map((r) => ({
      orderId: r.id,
      answers: this.decrypt(r.answers_ciphertext, r.id, r.owner_id),
    }));
  }
  async get(ownerId: string, orderId: string) {
    const row = (
      await pool.query(
        "SELECT r.form_snapshot,r.answers_ciphertext FROM bookings.orders o LEFT JOIN bookings.registrations r ON r.order_id=o.id WHERE o.id=$1 AND o.owner_id=$2",
        [orderId, ownerId],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Order not found.", 404);
    if (!row.answers_ciphertext) return { registration: null };
    const answers = this.decrypt(row.answers_ciphertext, orderId, ownerId);
    return { registration: { form: row.form_snapshot, answers } };
  }
}
