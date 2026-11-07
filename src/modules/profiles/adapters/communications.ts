import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  CommunicationInput,
  CommunicationStore,
} from "../application/communications.ts";
const projection =
  'language,marketing_email AS "marketingEmail",version,updated_at AS "updatedAt"';
export class PostgresCommunications implements CommunicationStore {
  async get(owner: string) {
    const result = await pool.query(
      `SELECT ${projection} FROM profiles.communication_preferences WHERE account_id=$1`,
      [owner],
    );
    return {
      ...(result.rows[0] ?? {
        language: "en",
        marketingEmail: false,
        version: 0,
        updatedAt: null,
      }),
      consentVersion: 1,
      transactionalMessagesRequired: true,
    };
  }
  async save(owner: string, input: CommunicationInput) {
    return transaction(async (tx) => {
      await tx.query(
        "INSERT INTO profiles.communication_preferences(account_id) VALUES($1) ON CONFLICT DO NOTHING",
        [owner],
      );
      const current = (
        await tx.query(
          `SELECT ${projection} FROM profiles.communication_preferences WHERE account_id=$1 FOR UPDATE`,
          [owner],
        )
      ).rows[0];
      // An identical lost-response retry has no new consent or version side effects.
      if (
        current.version !== input.version &&
        !(
          current.version === input.version + 1 &&
          current.language === input.language &&
          current.marketingEmail === input.marketingEmail
        )
      )
        throw new AppError(
          "VERSION_CONFLICT",
          "Preferences changed in another tab. Reload saved preferences before trying again.",
          409,
        );
      if (
        current.language === input.language &&
        current.marketingEmail === input.marketingEmail
      )
        return {
          ...current,
          consentVersion: 1,
          transactionalMessagesRequired: true,
        };
      const saved = (
        await tx.query(
          `UPDATE profiles.communication_preferences SET language=$2,marketing_email=$3,version=version+1,updated_at=clock_timestamp() WHERE account_id=$1 RETURNING ${projection}`,
          [owner, input.language, input.marketingEmail],
        )
      ).rows[0];
      if (current.marketingEmail !== input.marketingEmail)
        await tx.query(
          "INSERT INTO profiles.marketing_consent_history(account_id,purpose,policy_version,granted,preference_version) VALUES($1,'marketing_email',1,$2,$3)",
          [owner, input.marketingEmail, saved.version],
        );
      return {
        ...saved,
        consentVersion: 1,
        transactionalMessagesRequired: true,
      };
    });
  }
}
