import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { Principal, Access } from "../contracts/index.ts";
import type {
  IdentityStore,
  OtpDelivery,
} from "../application/authentication.ts";
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class PostgresIdentity implements IdentityStore, Access {
  constructor(
    private delivery: OtpDelivery,
    private secret: string,
  ) {}
  async request(contact: string) {
    if (!this.delivery.available() || this.secret.length < 32)
      throw new AppError(
        "OTP_UNAVAILABLE",
        "Email verification is not configured. No code has been sent.",
        503,
      );
    const id = randomUUID(),
      code = randomInt(0, 1000000).toString().padStart(6, "0");
    const verifier = createHmac("sha256", this.secret)
      .update(`${id}:${contact}:${code}`)
      .digest("hex");
    await transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))", [
        contact,
      ]);
      const rate = await tx.query(
        "SELECT count(*)::int n,max(created_at)>clock_timestamp()-interval '60 seconds' recent FROM identity.challenges WHERE contact=$1 AND created_at>clock_timestamp()-interval '1 hour'",
        [contact],
      );
      if (rate.rows[0].n >= 5 || rate.rows[0].recent)
        throw new AppError(
          "RATE_LIMITED",
          "Wait at least 60 seconds before requesting another code.",
          429,
        );
      await tx.query(
        "INSERT INTO identity.challenges(id,contact,verifier,expires_at,delivery_state) VALUES($1,$2,$3,clock_timestamp()+interval '5 minutes','pending')",
        [id, contact, verifier],
      );
    });
    try {
      await this.delivery.send(contact, code);
      await pool.query(
        "UPDATE identity.challenges SET delivery_state='accepted' WHERE id=$1",
        [id],
      );
    } catch (error) {
      await pool.query(
        "UPDATE identity.challenges SET delivery_state='unknown' WHERE id=$1",
        [id],
      );
      throw error;
    }
    return {
      challengeId: id,
      destination: contact.replace(/^(.).*(@.*)$/, "$1•••$2"),
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    };
  }
  async verify(id: string, code: string) {
    const result = await transaction(async (tx) => {
      const challenge = (
        await tx.query(
          "SELECT *,expires_at>clock_timestamp() fresh FROM identity.challenges WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (
        !challenge ||
        !challenge.fresh ||
        challenge.consumed ||
        challenge.attempts >= 5
      )
        return null;
      await tx.query(
        "UPDATE identity.challenges SET attempts=attempts+1 WHERE id=$1",
        [id],
      );
      const actual = createHmac("sha256", this.secret)
        .update(`${id}:${challenge.contact}:${code}`)
        .digest();
      if (!timingSafeEqual(Buffer.from(challenge.verifier, "hex"), actual))
        return null;
      const account = (
        await tx.query(
          "INSERT INTO identity.accounts(id,contact) VALUES($1,$2) ON CONFLICT(contact) DO UPDATE SET contact=excluded.contact RETURNING *",
          [randomUUID(), challenge.contact],
        )
      ).rows[0];
      if (account.status !== "active") return null;
      await tx.query(
        "UPDATE identity.challenges SET consumed=true WHERE id=$1",
        [id],
      );
      const token = randomBytes(32).toString("base64url");
      await tx.query(
        "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '12 hours')",
        [hashToken(token), account.id],
      );
      return {
        token,
        principal: {
          id: account.id,
          contact: account.contact,
          mfaVerified: false,
        },
      };
    });
    if (!result)
      throw new AppError(
        "INVALID_OTP",
        "Code is invalid, expired, or has reached its attempt limit.",
        401,
      );
    return result;
  }
  async authenticate(token: string | undefined): Promise<Principal> {
    if (!token)
      throw new AppError("AUTH_REQUIRED", "Sign in to continue.", 401);
    const r = await pool.query(
      "SELECT a.id,a.contact,coalesce(s.mfa_verified AND s.mfa_verified_at>clock_timestamp()-interval '30 minutes',false) AS mfa_verified FROM identity.sessions s JOIN identity.accounts a ON a.id=s.account_id WHERE token_hash=$1 AND s.expires_at>clock_timestamp() AND a.status='active'",
      [hashToken(token)],
    );
    if (!r.rowCount)
      throw new AppError(
        "AUTH_REQUIRED",
        "Your session has expired. Sign in again.",
        401,
      );
    return {
      id: r.rows[0].id,
      contact: r.rows[0].contact,
      mfaVerified: r.rows[0].mfa_verified,
    };
  }
  requireMfa(principal: Principal) {
    if (!principal.mfaVerified)
      throw new AppError(
        "MFA_REQUIRED",
        "Verify your authenticator before exporting personal data.",
        403,
      );
  }
  async require(principal: Principal, permission: string, scope = "platform") {
    if (!principal.mfaVerified)
      throw new AppError(
        "MFA_REQUIRED",
        "A verified staff MFA session is required.",
        403,
      );
    const grant = await pool.query(
      "SELECT 1 FROM identity.grants WHERE account_id=$1 AND permission=$2 AND scope=$3",
      [principal.id, permission, scope],
    );
    if (!grant.rowCount)
      throw new AppError(
        "FORBIDDEN",
        "You do not have permission for this action.",
        403,
      );
  }
  async logout(token: string) {
    await pool.query("DELETE FROM identity.sessions WHERE token_hash=$1", [
      hashToken(token),
    ]);
  }
}
