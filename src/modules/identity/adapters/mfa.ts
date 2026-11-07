import { createHash, randomBytes, randomUUID } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { MfaStore } from "../application/mfa.ts";
import {
  MFA_ELEVATION_SECONDS,
  mfaAttemptWindow,
} from "../domain/mfa-policy.ts";
import { base32, matchingCounter, MfaSecrets } from "./totp.ts";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export class PostgresMfa implements MfaStore {
  constructor(private secrets = new MfaSecrets()) {}
  private async session(tx: Transaction, token: string) {
    const candidate = (
      await tx.query(
        "SELECT account_id FROM identity.sessions WHERE token_hash=$1",
        [hash(token)],
      )
    ).rows[0];
    if (!candidate)
      throw new AppError(
        "AUTH_REQUIRED",
        "Sign in again before changing account security.",
        401,
      );
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,4))", [
      candidate.account_id,
    ]);
    const session = (
      await tx.query(
        "SELECT s.account_id,s.token_hash,s.mfa_verified,s.mfa_verified_at FROM identity.sessions s JOIN identity.accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp() AND a.status='active' FOR UPDATE OF s FOR SHARE OF a",
        [hash(token)],
      )
    ).rows[0];
    if (!session)
      throw new AppError(
        "AUTH_REQUIRED",
        "Sign in again before changing account security.",
        401,
      );
    await tx.query(
      "INSERT INTO identity.mfa(account_id) VALUES($1) ON CONFLICT DO NOTHING",
      [session.account_id],
    );
    const factor = (
      await tx.query(
        "SELECT * FROM identity.mfa WHERE account_id=$1 FOR UPDATE",
        [session.account_id],
      )
    ).rows[0];
    const now = (await tx.query("SELECT clock_timestamp() now")).rows[0]
      .now as Date;
    return { session, factor, now };
  }
  private fresh(session: any, now: Date) {
    return (
      session.mfa_verified &&
      session.mfa_verified_at &&
      now.getTime() - session.mfa_verified_at.getTime() <
        MFA_ELEVATION_SECONDS * 1000
    );
  }
  async status(token: string) {
    return transaction(async (tx) => {
      const { session, factor, now } = await this.session(tx, token);
      return {
        enrolled: Boolean(factor.secret_ciphertext),
        verified: Boolean(this.fresh(session, now)),
        enrollmentPending: Boolean(
          factor.pending_id && factor.pending_expires_at > now,
        ),
      };
    });
  }
  async begin(token: string) {
    return transaction(async (tx) => {
      const { session, factor, now } = await this.session(tx, token);
      if (factor.secret_ciphertext && !this.fresh(session, now))
        throw new AppError(
          "MFA_REQUIRED",
          "Verify your current authenticator or use a recovery code before replacing it.",
          403,
        );
      const window = mfaAttemptWindow(
        factor.failures,
        factor.window_started_at,
        now,
      );
      if (window.locked)
        throw new AppError(
          "MFA_RATE_LIMITED",
          "Too many attempts. Try again after the five-minute verification window.",
          429,
        );
      const secret = this.secrets.generate(),
        id = randomUUID();
      await tx.query(
        "UPDATE identity.mfa SET pending_id=$2,pending_ciphertext=$3,pending_session_hash=$4,pending_expires_at=clock_timestamp()+interval '10 minutes',updated_at=clock_timestamp() WHERE account_id=$1",
        [
          session.account_id,
          id,
          this.secrets.seal(secret, session.account_id),
          session.token_hash,
        ],
      );
      return {
        enrollmentId: id,
        secret: base32(secret),
        issuer: "BookMyTicket",
        digits: 6,
        periodSeconds: 30,
        expiresInSeconds: 600,
      };
    });
  }
  private async elevate(tx: Transaction, session: any) {
    await tx.query(
      "UPDATE identity.sessions SET mfa_verified=true,mfa_verified_at=clock_timestamp() WHERE token_hash=$1",
      [session.token_hash],
    );
  }
  private async failed(
    tx: Transaction,
    accountId: string,
    failures: number,
    reset: boolean,
  ) {
    await tx.query(
      "UPDATE identity.mfa SET failures=$2,window_started_at=CASE WHEN $3 THEN clock_timestamp() ELSE window_started_at END WHERE account_id=$1",
      [accountId, failures + 1, reset],
    );
  }
  private result(result: any) {
    if (result.error)
      throw new AppError(result.error, result.message, result.status);
    return result;
  }
  async confirm(token: string, id: string, code: string) {
    const result = await transaction(async (tx) => {
      const { session, factor, now } = await this.session(tx, token),
        window = mfaAttemptWindow(
          factor.failures,
          factor.window_started_at,
          now,
        );
      if (window.locked)
        return {
          error: "MFA_RATE_LIMITED",
          message:
            "Too many attempts. Try again after the five-minute verification window.",
          status: 429,
        };
      if (
        factor.pending_session_hash !== session.token_hash ||
        factor.pending_id !== id ||
        factor.pending_expires_at <= now ||
        !factor.pending_ciphertext
      ) {
        await this.failed(
          tx,
          session.account_id,
          window.failures,
          window.reset,
        );
        return {
          error: "MFA_ENROLLMENT_EXPIRED",
          message: "Authenticator setup expired or changed. Begin setup again.",
          status: 409,
        };
      }
      if (factor.secret_ciphertext && !this.fresh(session, now))
        return {
          error: "MFA_REQUIRED",
          message: "Verify your existing factor again before replacing it.",
          status: 403,
        };
      const counter = matchingCounter(
        this.secrets.open(factor.pending_ciphertext, session.account_id),
        code,
        now,
        -1,
      );
      if (counter === null) {
        await this.failed(
          tx,
          session.account_id,
          window.failures,
          window.reset,
        );
        return {
          error: "INVALID_MFA_CODE",
          message: "Authenticator code is invalid.",
          status: 401,
        };
      }
      await tx.query(
        "UPDATE identity.mfa SET secret_ciphertext=pending_ciphertext,last_counter=$2,pending_id=NULL,pending_session_hash=NULL,pending_ciphertext=NULL,pending_expires_at=NULL,failures=0,window_started_at=clock_timestamp(),updated_at=clock_timestamp() WHERE account_id=$1",
        [session.account_id, counter],
      );
      await tx.query(
        "DELETE FROM identity.mfa_recovery_codes WHERE account_id=$1",
        [session.account_id],
      );
      const codes = Array.from({ length: 8 }, () =>
        randomBytes(16).toString("hex"),
      );
      for (const code of codes)
        await tx.query(
          "INSERT INTO identity.mfa_recovery_codes(account_id,code_hash) VALUES($1,$2)",
          [session.account_id, hash(code)],
        );
      await tx.query(
        "DELETE FROM identity.sessions WHERE account_id=$1 AND token_hash<>$2",
        [session.account_id, session.token_hash],
      );
      await this.elevate(tx, session);
      return { verified: true, recoveryCodes: codes };
    });
    return this.result(result);
  }
  async verify(token: string, code: string) {
    const result = await transaction(async (tx) => {
      const { session, factor, now } = await this.session(tx, token),
        window = mfaAttemptWindow(
          factor.failures,
          factor.window_started_at,
          now,
        );
      if (window.locked)
        return {
          error: "MFA_RATE_LIMITED",
          message:
            "Too many attempts. Try again after the five-minute verification window.",
          status: 429,
        };
      const counter = factor.secret_ciphertext
        ? matchingCounter(
            this.secrets.open(factor.secret_ciphertext, session.account_id),
            code,
            now,
            Number(factor.last_counter),
          )
        : null;
      if (counter === null) {
        await this.failed(
          tx,
          session.account_id,
          window.failures,
          window.reset,
        );
        return {
          error: "INVALID_MFA_CODE",
          message:
            "Code is invalid, already used, or no authenticator is enrolled.",
          status: 401,
        };
      }
      await tx.query(
        "UPDATE identity.mfa SET last_counter=$2,failures=0,window_started_at=clock_timestamp() WHERE account_id=$1",
        [session.account_id, counter],
      );
      await this.elevate(tx, session);
      return { verified: true };
    });
    return this.result(result);
  }
  async recover(token: string, code: string) {
    const result = await transaction(async (tx) => {
      const { session, factor, now } = await this.session(tx, token),
        window = mfaAttemptWindow(
          factor.failures,
          factor.window_started_at,
          now,
        );
      if (window.locked)
        return {
          error: "MFA_RATE_LIMITED",
          message:
            "Too many attempts. Try again after the five-minute verification window.",
          status: 429,
        };
      const consumed = await tx.query(
        "UPDATE identity.mfa_recovery_codes SET used_at=clock_timestamp() WHERE account_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING code_hash",
        [session.account_id, hash(code)],
      );
      if (!consumed.rowCount) {
        await this.failed(
          tx,
          session.account_id,
          window.failures,
          window.reset,
        );
        return {
          error: "INVALID_RECOVERY_CODE",
          message: "Recovery code is invalid or already used.",
          status: 401,
        };
      }
      await tx.query(
        "UPDATE identity.mfa SET failures=0,window_started_at=clock_timestamp() WHERE account_id=$1",
        [session.account_id],
      );
      await this.elevate(tx, session);
      return { verified: true, replaceAuthenticatorRecommended: true };
    });
    return this.result(result);
  }
}
