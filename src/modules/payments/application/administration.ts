import type { Transaction } from "../../../shared/database.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import { csvCell } from "../domain/metadata.ts";
export type PaymentFilters = {
  booking?: string;
  transaction?: string;
  provider?: "razorpay";
  method?: string;
  state?: string;
  from?: string;
  until?: string;
  exception?: "true";
  after?: string;
};
export interface PaymentAdminStore {
  exceptions(tx: Transaction, actor: string, after?: string): Promise<unknown>;
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  list(
    tx: Transaction,
    actor: string,
    f: PaymentFilters,
    exporting?: boolean,
  ): Promise<{ items: Record<string, any>[]; nextCursor: string | null }>;
  detail(
    tx: Transaction,
    actor: string,
    id: string,
    after?: string,
  ): Promise<{
    attempt: Record<string, any>;
    capture: unknown;
    recovery: unknown;
    reconciliation: unknown;
    history: unknown;
  }>;
}
export class PaymentAdministration {
  constructor(
    private store: PaymentAdminStore,
    private access: StaffAuthorization,
    private audit: SecurityAudit,
  ) {}
  exceptions(actor: string, after?: string) {
    return this.store.run(async (tx) => {
      await this.access.requirePermission(tx, actor, "finance");
      const r = await this.store.exceptions(tx, actor, after);
      await this.audit.record(
        tx,
        actor,
        "payments.exceptions.read",
        "provider-orders",
        {},
      );
      return r;
    });
  }
  list(actor: string, f: PaymentFilters) {
    return this.store.run(async (tx) => {
      await this.access.requirePermission(tx, actor, "finance");
      const r = await this.store.list(tx, actor, f);
      await this.audit.record(tx, actor, "payments.admin.list", "attempts", {
        count: r.items.length,
      });
      return r;
    });
  }
  detail(actor: string, id: string, after?: string) {
    return this.store.run(async (tx) => {
      await this.access.requirePermission(tx, actor, "finance");
      const r = await this.store.detail(tx, actor, id, after);
      await this.audit.record(tx, actor, "payments.admin.detail", id, {});
      return {
        ...r,
        settlement: { state: "not_connected", amountPaise: null },
        capturePolicy: {
          mode: "merchant_auto_capture",
          partialCaptureSupported: false,
        },
        refundEligibility: {
          eligible: null,
          actionAvailable: false,
          reason:
            "Refund execution and booking-policy approval are not implemented. Provider-refunded observations are not a platform refund ledger.",
        },
      };
    });
  }
  export(
    actor: string,
    input: { filters: PaymentFilters; reason: string; confirm: true },
  ) {
    return this.store.run(async (tx) => {
      await this.access.requirePermission(tx, actor, "finance");
      const f = input.filters;
      if (
        !f.from ||
        !f.until ||
        Date.parse(f.until) - Date.parse(f.from) > 366 * 86400000 ||
        Date.parse(f.until) <= Date.parse(f.from) ||
        f.after
      )
        throw new AppError(
          "INVALID_REPORT_RANGE",
          "Select an increasing date range of at most 366 days without a page cursor.",
          422,
        );
      const result = await this.store.list(tx, actor, f, true);
      if (result.items.length > 5000)
        throw new AppError(
          "REPORT_TOO_LARGE",
          "Narrow the filters to at most 5000 transactions.",
          422,
        );
      await this.audit.record(
        tx,
        actor,
        "payments.report.approved",
        "transactions",
        { reason: input.reason, count: result.items.length, filters: f },
      );
      const columns = [
        "id",
        "transaction_id",
        "booking_id",
        "provider",
        "method",
        "state",
        "amount_paise",
        "currency",
        "amount_refunded_paise",
        "error_code",
        "error_reason",
        "created_at",
      ];
      return {
        filename: "payment-transactions.csv",
        csv:
          [
            columns.map(csvCell).join(","),
            ...result.items.map((r) =>
              columns
                .map((k) =>
                  csvCell(r[k] instanceof Date ? r[k].toISOString() : r[k]),
                )
                .join(","),
            ),
          ].join("\r\n") + "\r\n",
        rows: result.items.length,
      };
    });
  }
}
