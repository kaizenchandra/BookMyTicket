import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  SavedAttendee,
  SavedAttendeesInput,
  SavedAttendeesStore,
} from "../application/saved-attendees.ts";
export class PostgresSavedAttendees implements SavedAttendeesStore {
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
        "INSERT INTO profiles.attendee_consent_history(account_id,preference_version,purpose,policy_version,granted) VALUES($1,$2,'saved_attendees',1,$3)",
        [owner, version, input.consent],
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
