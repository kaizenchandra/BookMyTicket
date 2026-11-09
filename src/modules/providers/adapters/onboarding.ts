import { createHash } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { OnboardingStore } from "../application/onboarding.ts";
import type { OnboardingDetails } from "../domain/onboarding.ts";
import { requireEditableOrganization } from "../domain/draft.ts";
export class PostgresOnboarding implements OnboardingStore {
  constructor(private audit: SecurityAudit) {}
  private async load(tx: Transaction, org: string) {
    const row = (
      await tx.query(
        `SELECT o.id AS "organizationId",o.version,o.state,coalesce(d.legal_name,'') AS "legalName",coalesce(d.business_address,'') AS "businessAddress",coalesce(d.contact_name,'') AS "contactName",coalesce(d.contact_email,'') AS "contactEmail",coalesce(d.contact_phone,'') AS "contactPhone" FROM providers.organizations o LEFT JOIN providers.onboarding_details d ON d.organization_id=o.id WHERE o.id=$1 FOR UPDATE OF o`,
        [org],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Organization not found.", 404);
    const { organizationId, version, state, ...details } = row;
    return {
      organizationId,
      version,
      state,
      details: details as OnboardingDetails,
    };
  }
  private async owner(tx: Transaction, actor: string, org: string) {
    const member = (
      await tx.query(
        "SELECT role FROM providers.memberships WHERE organization_id=$1 AND account_id=$2 FOR SHARE",
        [org, actor],
      )
    ).rows[0];
    if (member?.role !== "owner")
      throw new AppError(
        "FORBIDDEN",
        "Only organization owners can access private onboarding details.",
        403,
      );
  }
  readOwner(actor: string, org: string) {
    return transaction(async (tx) => {
      const row = await this.load(tx, org);
      await this.owner(tx, actor, org);
      await this.audit.record(tx, actor, "provider.onboarding.read", org, {
        version: row.version,
      });
      return row;
    });
  }
  readReview(actor: string, org: string) {
    return transaction(async (tx) => {
      const row = await this.load(tx, org);
      await this.audit.record(
        tx,
        actor,
        "provider.onboarding.review_read",
        org,
        { version: row.version },
      );
      return row;
    });
  }
  save(
    actor: string,
    org: string,
    input: OnboardingDetails & { expectedVersion: number },
  ) {
    return transaction(async (tx) => {
      const row = await this.load(tx, org);
      await this.owner(tx, actor, org);
      const { expectedVersion, ...details } = input;
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            "provider.onboarding.save.v1",
            org,
            actor,
            expectedVersion,
            details.legalName,
            details.businessAddress,
            details.contactName,
            details.contactEmail,
            details.contactPhone,
          ]),
        )
        .digest("hex");
      const prior = (
        await tx.query(
          "SELECT actor_id,fingerprint,state,version FROM providers.onboarding_saves WHERE organization_id=$1 AND input_version=$2",
          [org, expectedVersion],
        )
      ).rows[0];
      if (prior) {
        if (prior.actor_id !== actor || prior.fingerprint !== fingerprint)
          throw new AppError(
            "ONBOARDING_SAVE_CONFLICT",
            "This onboarding version already has a different recorded save.",
            409,
          );
        await this.audit.record(
          tx,
          actor,
          "provider.onboarding.save_recovered",
          org,
          { version: prior.version },
        );
        return {
          organizationId: org,
          version: prior.version,
          state: prior.state,
          details,
        };
      }
      requireEditableOrganization(row.state);
      if (row.version !== expectedVersion) {
        throw new AppError(
          "VERSION_CONFLICT",
          "Onboarding changed. Reload and review before saving again.",
          409,
        );
      }
      await tx.query(
        "INSERT INTO providers.onboarding_details(organization_id,legal_name,business_address,contact_name,contact_email,contact_phone) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id) DO UPDATE SET legal_name=$2,business_address=$3,contact_name=$4,contact_email=$5,contact_phone=$6,updated_at=clock_timestamp()",
        [
          org,
          details.legalName,
          details.businessAddress,
          details.contactName,
          details.contactEmail,
          details.contactPhone,
        ],
      );
      await tx.query(
        "UPDATE providers.organizations SET version=version+1 WHERE id=$1",
        [org],
      );
      await tx.query(
        "INSERT INTO providers.onboarding_saves(organization_id,input_version,version,actor_id,fingerprint,state) VALUES($1,$2,$3,$4,$5,$6)",
        [
          org,
          expectedVersion,
          expectedVersion + 1,
          actor,
          fingerprint,
          row.state,
        ],
      );
      await this.audit.record(tx, actor, "provider.onboarding.saved", org, {
        version: expectedVersion + 1,
      });
      return { ...row, version: expectedVersion + 1, details };
    });
  }
}
