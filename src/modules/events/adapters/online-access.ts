import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { RegistrationTarget } from "../../inventory/contracts/index.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { OnlineEligibility } from "../contracts/index.ts";
import type {
  OnlineAccessStore,
  OnlineSettings,
} from "../application/online-access.ts";
export class PostgresOnlineAccess implements OnlineAccessStore {
  constructor(
    private target: RegistrationTarget,
    private organizations: OrganizationAccess,
    private eligibility: OnlineEligibility,
    private audit: SecurityAudit,
  ) {}
  private key() {
    const value = process.env.TICKET_ENCRYPTION_KEY ?? "";
    if (!/^[a-f0-9]{64}$/i.test(value))
      throw new AppError(
        "ONLINE_ACCESS_UNAVAILABLE",
        "Online access encryption is not configured.",
        503,
      );
    return createHmac("sha256", Buffer.from(value, "hex"))
      .update("events.online-access.v1")
      .digest();
  }
  private encrypt(id: string, url: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    cipher.setAAD(Buffer.from(id));
    const bytes = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
  }
  private decrypt(id: string, value: string) {
    const b = Buffer.from(value, "base64"),
      cipher = createDecipheriv("aes-256-gcm", this.key(), b.subarray(0, 12));
    cipher.setAAD(Buffer.from(id));
    cipher.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([
      cipher.update(b.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  }
  configuration(actor: string, occurrence: string) {
    return transaction(async (tx) => {
      const target = await this.target.lockForRegistration(tx, occurrence);
      await this.organizations.requireMember(
        actor,
        target.organizationId,
        true,
        tx,
      );
      const row = (
        await tx.query(
          "SELECT opens_at,closes_at,enabled,version FROM events.online_access WHERE occurrence_id=$1",
          [occurrence],
        )
      ).rows[0];
      return { configuration: row ?? null };
    });
  }
  configure(actor: string, occurrence: string, input: OnlineSettings) {
    return transaction(async (tx) => {
      const target = await this.target.lockForRegistration(tx, occurrence);
      await this.organizations.requireMember(
        actor,
        target.organizationId,
        true,
        tx,
      );
      await this.organizations.requireApproved(target.organizationId, tx);
      if (target.state !== "open")
        throw new AppError(
          "OCCURRENCE_CLOSED",
          "Only open sessions can change online access.",
          409,
        );
      const current = (
        await tx.query(
          "SELECT version,url_ciphertext FROM events.online_access WHERE occurrence_id=$1 FOR UPDATE",
          [occurrence],
        )
      ).rows[0];
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new AppError(
          "VERSION_CONFLICT",
          "Online access settings changed. Reload before saving.",
          409,
        );
      if (!input.url && !current)
        throw new AppError(
          "JOIN_URL_REQUIRED",
          "Provide an HTTPS joining URL for the first configuration.",
          422,
        );
      const ciphertext = input.url
        ? this.encrypt(occurrence, input.url)
        : current.url_ciphertext;
      const saved = (
        await tx.query(
          "INSERT INTO events.online_access(occurrence_id,url_ciphertext,opens_at,closes_at,enabled) VALUES($1,$2,$3,$4,$5) ON CONFLICT(occurrence_id) DO UPDATE SET url_ciphertext=$2,opens_at=$3,closes_at=$4,enabled=$5,version=events.online_access.version+1 RETURNING opens_at,closes_at,enabled,version",
          [
            occurrence,
            ciphertext,
            input.opensAt,
            input.closesAt,
            input.enabled,
          ],
        )
      ).rows[0];
      await this.audit.record(
        tx,
        actor,
        "event.online_access_configured",
        occurrence,
        { version: saved.version, enabled: input.enabled },
      );
      return { configuration: saved };
    });
  }
  access(owner: string, order: string, occurrence: string, reveal: boolean) {
    return transaction(async (tx) => {
      await this.eligibility.authorize(tx, owner, order, occurrence);
      const row = (
        await tx.query(
          "SELECT * FROM events.online_access WHERE occurrence_id=$1 FOR SHARE",
          [occurrence],
        )
      ).rows[0];
      if (!row) return { configured: false };
      // Read authoritative time after all row locks have been acquired.
      const now = (await tx.query("SELECT clock_timestamp() AS now")).rows[0]
        .now;
      row.server_time = now;
      row.allowed = row.enabled && now >= row.opens_at && now < row.closes_at;
      const result = {
        configured: true,
        allowed: row.allowed,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        serverTime: row.server_time,
        reason: !row.enabled
          ? "disabled"
          : row.allowed
            ? null
            : row.server_time < row.opens_at
              ? "not_open"
              : "expired",
      };
      if (!reveal) return result;
      if (!row.allowed)
        throw new AppError(
          "ONLINE_ACCESS_CLOSED",
          "Online access is outside its permitted window or disabled.",
          409,
        );
      const url = this.decrypt(occurrence, row.url_ciphertext);
      await this.audit.record(
        tx,
        owner,
        "event.online_access_revealed",
        occurrence,
        { orderId: order, version: row.version },
      );
      return { ...result, url };
    });
  }
}
