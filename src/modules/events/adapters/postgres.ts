import { randomUUID } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import type { FormStore } from "../application/forms.ts";
import type { AssignedForm, FormDefinition } from "../contracts/index.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
import type { RegistrationTarget } from "../../inventory/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresForms implements FormStore {
  constructor(
    private target: RegistrationTarget,
    private access: OrganizationAccess,
    private audit: SecurityAudit,
  ) {}
  async definition(
    tx: Transaction,
    occurrence: string,
    form: string,
  ): Promise<AssignedForm> {
    const row = (
      await tx.query(
        "SELECT id,version,definition FROM events.registration_forms WHERE id=$1 AND occurrence_id=$2",
        [form, occurrence],
      )
    ).rows[0];
    if (!row)
      throw new AppError(
        "NOT_FOUND",
        "Form version not found for this occurrence.",
        404,
      );
    return row;
  }
  async current(tx: Transaction, id: string): Promise<AssignedForm | null> {
    return (
      (
        await tx.query(
          "SELECT f.id,f.version,f.definition FROM events.form_assignments a JOIN events.registration_forms f ON f.id=a.form_id WHERE a.occurrence_id=$1 FOR SHARE OF a",
          [id],
        )
      ).rows[0] ?? null
    );
  }
  list(actor: string, id: string) {
    return transaction(async (tx) => {
      const target = await this.target.lockForRegistration(tx, id);
      await this.access.requireMember(actor, target.organizationId, false, tx);
      return {
        current: await this.current(tx, id),
        history: (
          await tx.query(
            "SELECT id,version,definition,created_at FROM events.registration_forms WHERE occurrence_id=$1 ORDER BY version DESC LIMIT 100",
            [id],
          )
        ).rows,
      };
    });
  }
  publish(
    actor: string,
    id: string,
    version: number,
    definition: FormDefinition,
  ) {
    return transaction(async (tx) => {
      const target = await this.target.lockForRegistration(tx, id);
      await this.access.requireMember(actor, target.organizationId, true, tx);
      await this.access.requireApproved(target.organizationId, tx);
      if (["cancelled", "closed"].includes(target.state))
        throw new AppError(
          "OCCURRENCE_CLOSED",
          "Closed occurrences cannot accept new registration forms.",
          409,
        );
      const previous = await this.current(tx, id);
      if ((previous?.version ?? 0) !== version)
        throw new AppError(
          "VERSION_CONFLICT",
          "The registration form changed. Refresh and review it before publishing.",
          409,
        );
      const formId = randomUUID(),
        next = version + 1;
      await tx.query(
        "INSERT INTO events.registration_forms(id,occurrence_id,version,definition,created_by) VALUES($1,$2,$3,$4,$5)",
        [formId, id, next, definition, actor],
      );
      await tx.query(
        "INSERT INTO events.form_assignments(occurrence_id,form_id,version) VALUES($1,$2,$3) ON CONFLICT(occurrence_id) DO UPDATE SET form_id=$2,version=$3",
        [id, formId, next],
      );
      await this.audit.record(
        tx,
        actor,
        "registration.form_published",
        formId,
        {
          occurrenceId: id,
          version: next,
          fieldCount: definition.fields.length,
        },
      );
      return { id: formId, version: next, definition };
    });
  }
}
