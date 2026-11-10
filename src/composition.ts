import {AdminCancellationAuthority,AdminDocumentAuthority} from "./modules/bookings/adapters/cancellation-authority.ts";
import {PostgresStaffAuthorization} from "./modules/identity/adapters/staff-authorization.ts";
import { OnlineAccess } from "./modules/events/application/online-access.ts";
import { PostgresOnlineAccess } from "./modules/events/adapters/online-access.ts";
import { PostgresOnlineEligibility } from "./modules/bookings/adapters/online-eligibility.ts";
import { FreeCancellation } from "./modules/bookings/application/free-cancellation.ts";
import { PostgresFreeCancellation } from "./modules/bookings/adapters/free-cancellation.ts";
import { PostgresFreeCancellationInventory } from "./modules/inventory/adapters/free-cancellation.ts";
import { PostgresUnusedTickets } from "./modules/ticketing/adapters/cancellation.ts";
import { FreeConfirmation } from "./modules/bookings/application/free-confirmation.ts";
import { PostgresFreeBookings } from "./modules/bookings/adapters/free-confirmation.ts";
import { Notifications } from "./modules/notifications/application/inbox.ts";
import { PostgresNotifications } from "./modules/notifications/adapters/postgres.ts";
import { PostgresConsumer } from "./modules/reporting/adapters/consumer.ts";
import { PendingCancellation } from "./modules/bookings/application/pending-cancellation.ts";
import { PostgresPendingCancellation } from "./modules/bookings/adapters/pending-cancellation.ts";
import { PostgresPendingRelease } from "./modules/inventory/adapters/pending-release.ts";
import { PostgresCancellationPaymentStatus } from "./modules/payments/adapters/cancellation-status.ts";
import { TicketWallet } from "./modules/bookings/application/wallet.ts";
import { PostgresTicketOccurrences } from "./modules/inventory/adapters/ticket-occurrences.ts";
import { QrCodes } from "./modules/ticketing/adapters/qr.ts";
import { AttendeeExports } from "./modules/reporting/application/exports.ts";
import { PostgresExports } from "./modules/reporting/adapters/exports.ts";
import { PostgresActiveAccount } from "./modules/identity/adapters/active.ts";
import { Forms } from "./modules/events/application/forms.ts";
import { PostgresForms } from "./modules/events/adapters/postgres.ts";
import { PostgresRegistrationTarget } from "./modules/inventory/adapters/registration-target.ts";
import { PostgresProviders } from "./modules/providers/adapters/postgres.ts";
import { PostgresAudit } from "./modules/reporting/adapters/audit.ts";
import { PostgresRegistrations } from "./modules/bookings/adapters/registrations.ts";
import { transaction } from "./shared/database.ts";
import { PaymentOrders } from "./modules/bookings/application/payment.ts";
import { PostgresCatalog } from "./modules/catalog/adapters/postgres.ts";
import { Quotes } from "./modules/pricing/application/quotes.ts";
import { PostgresQuotes } from "./modules/pricing/adapters/postgres.ts";
import { OrderPlacement } from "./modules/bookings/application/placement.ts";
import { PostgresPlacement } from "./modules/bookings/adapters/placement.ts";
import { PostgresAdmissionWindow } from "./modules/inventory/adapters/admission.ts";
import { Checkout } from "./modules/bookings/application/checkout.ts";
import { PostgresBookings } from "./modules/bookings/adapters/postgres.ts";
import { PostgresInventoryCommerce } from "./modules/inventory/adapters/commerce.ts";
import { PostgresCaptures } from "./modules/payments/adapters/captures.ts";
import { PostgresTickets } from "./modules/ticketing/adapters/postgres.ts";
import { PostgresLedger } from "./modules/finance/adapters/postgres.ts";
import { PostgresEvents } from "./modules/reporting/adapters/outbox.ts";
import { Collection } from "./modules/payments/application/collection.ts";
import { PostgresCollection } from "./modules/payments/adapters/collection.ts";
import { Razorpay } from "./modules/payments/adapters/razorpay.ts";
export function commerce() {
  const bookings = new PostgresBookings(),
    tickets = new PostgresTickets(new PostgresAdmissionWindow()),
    razorpay = new Razorpay();
  const inventory = new PostgresInventoryCommerce(new PostgresCatalog());
  const quotes = new Quotes(new PostgresQuotes(), inventory);
  const formStore = new PostgresForms(
    new PostgresRegistrationTarget(),
    new PostgresProviders(),
    new PostgresAudit(),
  );
  const forms = new Forms(formStore);
  const registrations = new PostgresRegistrations();
  const exportAccess = new PostgresProviders(),
    activeAccount = new PostgresActiveAccount(),
    exportTarget = new PostgresRegistrationTarget();
  const attendeeExports = new AttendeeExports(
    new PostgresExports(
      {
        authorize: async (tx, actor, occurrence) => {
          const target = await exportTarget.lockForRegistration(tx, occurrence);
          await activeAccount.requireActive(tx, actor);
          await exportAccess.requireExport(actor, target.organizationId, tx);
        },
        fields: async (tx, occurrence, form) =>
          (await formStore.definition(tx, occurrence, form)).definition.fields,
        rows: (tx, occurrence, form) =>
          registrations.confirmed(tx, occurrence, form),
      },
      new PostgresAudit(),
    ),
  );
  const placement = new OrderPlacement(
    new PostgresPlacement(),
    inventory,
    quotes,
    forms,
  );
  const checkout = new Checkout(
    bookings,
    inventory,
    new PostgresCaptures(),
    tickets,
    new PostgresLedger(),
    new PostgresEvents(),
  );
  const paymentOrders = new PaymentOrders(bookings, inventory, quotes);
  return {
    freeCancellation: new FreeCancellation(
      new PostgresFreeCancellation(),
      new PostgresFreeCancellationInventory(),
      new PostgresUnusedTickets(),
      new PostgresEvents(),
      new PostgresAudit(),
    ),
    freeConfirmation: new FreeConfirmation(
      new PostgresFreeBookings(),
      inventory,
      tickets,
      new PostgresEvents(),
      new PostgresAudit(),
    ),
    adminPendingCancellation: new PendingCancellation(new PostgresPendingCancellation(),new PostgresPendingRelease(),new PostgresCancellationPaymentStatus(),new PostgresEvents(),new PostgresAudit(),new AdminCancellationAuthority(new PostgresStaffAuthorization())),
    pendingCancellation: new PendingCancellation(
      new PostgresPendingCancellation(),
      new PostgresPendingRelease(),
      new PostgresCancellationPaymentStatus(),
      new PostgresEvents(),
      new PostgresAudit(),
    ),
    adminWallet: new TicketWallet(bookings,new PostgresTicketOccurrences(),tickets,new QrCodes(),new AdminDocumentAuthority(new PostgresStaffAuthorization(),new PostgresAudit())),
    wallet: new TicketWallet(
      bookings,
      new PostgresTicketOccurrences(),
      tickets,
      new QrCodes(),
    ),
    onlineAccess: new OnlineAccess(
      new PostgresOnlineAccess(
        new PostgresRegistrationTarget(),
        new PostgresProviders(),
        new PostgresOnlineEligibility(new PostgresTicketOccurrences(), tickets),
        new PostgresAudit(),
      ),
    ),
    attendeeExports,
    forms,
    registrations,
    registrationPreview: (owner: string, id: string) =>
      transaction(async (tx) => {
        const r = await inventory.snapshot(tx, owner, id);
        return {
          form: await forms.current(tx, r.occurrences[0]!.id),
          quantity: r.items.reduce((n, i) => n + i.quantity, 0),
        };
      }),
    paymentOrders,
    bookings,
    tickets,
    quotes,
    placement,
    checkout,
    collection: new Collection(
      razorpay,
      new PostgresCollection(),
      (p) => checkout.captured(p),
      paymentOrders,
    ),
    razorpay,
  };
}

export function notificationService() {
  return new Notifications(new PostgresNotifications(), new PostgresConsumer());
}
