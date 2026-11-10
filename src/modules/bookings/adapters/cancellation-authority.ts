import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import type { CancellationAuthority } from "../application/pending-cancellation.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export class AdminCancellationAuthority implements CancellationAuthority {
  constructor(private access: StaffAuthorization) {}
  async resolve(tx: Transaction, actor: string, id: string) {
    await this.access.requirePermission(tx, actor, "bookings.read");
    await this.access.requirePermission(tx, actor, "bookings.manage");
    const r = (
      await tx.query("SELECT owner_id FROM bookings.orders WHERE id=$1", [id])
    ).rows[0];
    if (!r) throw new AppError("NOT_FOUND", "Booking not found.", 404);
    return r.owner_id as string;
  }
}

export class AdminDocumentAuthority extends AdminCancellationAuthority {
  constructor(
    access: StaffAuthorization,
    private audit: SecurityAudit,
  ) {
    super(access);
  }
  async resolve(tx: Transaction, actor: string, id: string) {
    const owner = await super.resolve(tx, actor, id);
    await this.audit.record(tx, actor, "bookings.ticket_document.read", id, {
      customerId: owner,
    });
    return owner;
  }
}
