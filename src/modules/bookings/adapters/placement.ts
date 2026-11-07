import { randomUUID } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { PlacementStore } from "../application/placement.ts";
import type { Quote } from "../../pricing/contracts/index.ts";
import { PostgresRegistrations } from "./registrations.ts";
import type {
  AcceptedRegistration,
  RegistrationInput,
} from "../../events/contracts/index.ts";
export class PostgresPlacement implements PlacementStore {
  constructor(private registrations = new PostgresRegistrations()) {}
  registrationFingerprint(input?: RegistrationInput) {
    return this.registrations.fingerprint(input);
  }
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async serialize(
    tx: Transaction,
    ownerId: string,
    _reservationId: string,
    _key: string,
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,3))", [
      ownerId,
    ]);
  }
  async previous(
    tx: Transaction,
    ownerId: string,
    key: string,
    fingerprint: string,
  ) {
    const command = (
      await tx.query(
        "SELECT fingerprint,order_id FROM bookings.placement_commands WHERE owner_id=$1 AND operation_key=$2",
        [ownerId, key],
      )
    ).rows[0];
    if (!command) return null;
    if (command.fingerprint !== fingerprint)
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "The checkout key was used with different input.",
        409,
      );
    return (
      await tx.query("SELECT * FROM bookings.orders WHERE id=$1", [
        command.order_id,
      ])
    ).rows[0];
  }
  async existing(
    tx: Transaction,
    ownerId: string,
    reservationId: string,
    quoteId: string,
    digest?: string,
  ) {
    const row = (
      await tx.query(
        "SELECT * FROM bookings.orders WHERE owner_id=$1 AND reservation_id=$2",
        [ownerId, reservationId],
      )
    ).rows[0];
    if (!row) return null;
    const saved = (
      await tx.query(
        "SELECT input_digest FROM bookings.registrations WHERE order_id=$1",
        [row.id],
      )
    ).rows[0];
    if (row.quote_id !== quoteId || saved?.input_digest !== digest)
      throw new AppError(
        "ORDER_ALREADY_EXISTS",
        "This reservation already has an accepted order. Retrieve its status before starting another payment.",
        409,
      );
    return row;
  }
  async recordCommand(
    tx: Transaction,
    ownerId: string,
    key: string,
    fingerprint: string,
    order: unknown,
  ) {
    await tx.query(
      "INSERT INTO bookings.placement_commands(owner_id,operation_key,fingerprint,order_id) VALUES($1,$2,$3,$4)",
      [ownerId, key, fingerprint, (order as { id: string }).id],
    );
  }
  async place(
    tx: Transaction,
    ownerId: string,
    quote: Quote,
    registration: AcceptedRegistration | null,
    digest?: string,
  ) {
    const order = (
      await tx.query(
        "INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,snapshot,quote_id,accepted_at) VALUES($1,$2,$3,$4,'INR',$5,$6,$7,clock_timestamp()) RETURNING *",
        [
          randomUUID(),
          ownerId,
          quote.reservationId,
          quote.prices.totalPaise,
          quote.policyId,
          {
            ...(quote.reservationSnapshot as object),
            quote: {
              id: quote.id,
              policyId: quote.policyId,
              policyLabel: quote.policyLabel,
              policy: quote.policy,
              prices: quote.prices,
            },
            acknowledgment: { cancellation: true, admission: true },
          },
          quote.id,
        ],
      )
    ).rows[0];
    if (registration)
      await this.registrations.save(
        tx,
        order.id,
        ownerId,
        registration,
        digest!,
      );
    return order;
  }
}
