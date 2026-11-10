import { consentPolicies } from "../domain/consent-policies.ts";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  SavedAttendee,
  SavedAttendeesInput,
  SavedAttendeesStore,
} from "../application/saved-attendees.ts";
export class PostgresSavedAttendees implements SavedAttendeesStore {
  async maskedForAdministration(tx: Transaction, owner: string) {
    const row = (
      await tx.query(
        `SELECT ciphertext FROM profiles.saved_attendees WHERE account_id=$1 AND (SELECT granted FROM profiles.attendee_consent_history WHERE account_id=$1 ORDER BY preference_version DESC LIMIT 1)=true`,
        [owner],
      )
    ).rows[0];
    if (!row?.ciphertext) return { available: true, items: [] };
    try {
      return {
        available: true,
        items: this.decrypt(owner, row.ciphertext).map((i) => ({
          id: i.id,
          name: i.name ? i.name.slice(0, 1) + "***" : "",
          email: i.email ? i.email.replace(/^(.).*(@.*)$/, "$1***$2") : "",
          phone: i.phone ? "***" + i.phone.slice(-4) : "",
        })),
      };
    } catch {
      return { available: false, items: [] };
    }
  }
  async history(owner: string, beforeVersion?: number) {
    const rows = (
      await pool.query(
        `SELECT purpose,policy_version AS "policyVersion",granted,policy_text AS "policyText",preference_version AS "preferenceVersion",created_at AS "recordedAt"
       FROM profiles.attendee_consent_history WHERE account_id=$1 AND ($2::integer IS NULL OR preference_version<$2)
       ORDER BY preference_version DESC LIMIT 21`,
        [owner, beforeVersion ?? null],
      )
    ).rows;
    const items = rows.slice(0, 20);
    return {
      items,
      nextCursor: rows.length > 20 ? items.at(-1).preferenceVersion : null,
    };
  }
  private key() {
    const secret = process.env.REGISTRATION_ENCRYPTION_KEY;
    if (!secret || !/^[a-f0-9]{64}$/i.test(secret))
      throw new AppError(
        "ATTENDEES_UNAVAILABLE",
        "Saved attendee encryption is unavailable. Try again later.",
        503,
      );
    return Buffer.from(
      hkdfSync(
        "sha256",
        Buffer.from(secret, "hex"),
        Buffer.alloc(0),
        "profiles.saved-attendees:v1",
        32,
      ),
    );
  }
  private encrypt(owner: string, items: SavedAttendee[]) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    cipher.setAAD(Buffer.from(`saved-attendees:${owner}`));
    return Buffer.concat([
      iv,
      cipher.update(JSON.stringify(items)),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString("base64");
  }
  private decrypt(owner: string, text: string): SavedAttendee[] {
    const bytes = Buffer.from(text, "base64"),
      cipher = createDecipheriv(
        "aes-256-gcm",
        this.key(),
        bytes.subarray(0, 12),
      );
    cipher.setAAD(Buffer.from(`saved-attendees:${owner}`));
    cipher.setAuthTag(bytes.subarray(-16));
    return JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(12, -16)),
        cipher.final(),
      ]).toString(),
    );
  }
  private view(
    owner: string,
    row: { version: number; ciphertext: string | null },
  ) {
    return {
      version: row.version,
      consentVersion: 1 as const,
      consent: row.ciphertext !== null,
      items: row.ciphertext ? this.decrypt(owner, row.ciphertext) : [],
    };
  }
  async get(owner: string) {
    const row = (
      await pool.query(
        "SELECT version,ciphertext FROM profiles.saved_attendees WHERE account_id=$1",
        [owner],
      )
    ).rows[0] ?? { version: 0, ciphertext: null };
    return this.view(owner, row);
  }
  async save(owner: string, input: SavedAttendeesInput) {
    return transaction(async (tx) => {
      await tx.query(
        "INSERT INTO profiles.saved_attendees(account_id) VALUES($1) ON CONFLICT DO NOTHING",
        [owner],
      );
      const row = (
        await tx.query(
          "SELECT version,ciphertext FROM profiles.saved_attendees WHERE account_id=$1 FOR UPDATE",
          [owner],
        )
      ).rows[0];
      if (row.version !== input.expectedVersion) {
        if (row.version === input.expectedVersion + 1) {
          const current = this.view(owner, row);
          if (
            current.consent === input.consent &&
            JSON.stringify(current.items) === JSON.stringify(input.items)
          )
            return current;
        }
        throw new AppError(
          "VERSION_CONFLICT",
          "Saved attendees changed elsewhere. Reload and review before saving again.",
          409,
        );
      }
      const ciphertext = input.consent
          ? this.encrypt(owner, input.items)
          : null,
        version = row.version + 1;
      await tx.query(
        "UPDATE profiles.saved_attendees SET ciphertext=$2,version=$3,updated_at=clock_timestamp() WHERE account_id=$1",
        [owner, ciphertext, version],
      );
      await tx.query(
        "INSERT INTO profiles.attendee_consent_history(account_id,preference_version,purpose,policy_version,granted,policy_text) VALUES($1,$2,'saved_attendees',1,$3,$4)",
        [owner, version, input.consent, consentPolicies.saved_attendees.text],
      );
      return {
        version,
        consentVersion: 1 as const,
        consent: input.consent,
        items: input.items,
      };
    });
  }
}
