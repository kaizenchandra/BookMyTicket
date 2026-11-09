import { venueDirections } from "../domain/directions.ts";
import type { WalletView } from "../contracts/wallet.ts";
import type { Transaction } from "../../../shared/database.ts";
import type { TicketOccurrences } from "../../inventory/contracts/index.ts";
import type {
  TicketReader,
  TicketCodeRenderer,
} from "../../ticketing/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import { calendar } from "../domain/calendar.ts";
export interface WalletStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  get(owner: string, id: string, tx?: Transaction): Promise<any>;
}
export class TicketWallet {
  constructor(
    private store: WalletStore,
    private occurrences: TicketOccurrences,
    private tickets: TicketReader,
    private renderer: TicketCodeRenderer,
  ) {}
  private read(owner: string, id: string, credentials: boolean) {
    return this.store.unitOfWork(async (tx) => {
      const order = await this.store.get(owner, id, tx),
        serverTime = new Date(order.server_time).toISOString();
      if (order.state !== "confirmed")
        return {
          orderId: id,
          bookingState: order.state,
          serverTime,
          issuance: "not_confirmed" as const,
          occurrences: [],
          items: [],
          instructions: order.snapshot.quote?.policy?.admissionTerms ?? "",
        };
      const occurrences = await this.occurrences.read(
        tx,
        (order.snapshot.occurrences ?? []).map((o: any) => o.id),
      );
      const allowed = credentials
        ? occurrences
            .filter(
              (o) =>
                o.state !== "cancelled" &&
                Date.parse(o.endsAt) >= Date.parse(serverTime),
            )
            .map((o) => o.id)
        : [];
      const rows = await this.tickets.list(owner, id, tx, allowed);
      const items = rows.map((t) => {
        const occurrence = occurrences.find((o) => o.id === t.occurrenceId);
        const status =
          t.state === "replaced"
            ? "transferred"
            : t.state !== "valid"
              ? t.state
              : !occurrence || occurrence.state === "cancelled"
                ? "cancelled"
                : Date.parse(occurrence.endsAt) < Date.parse(serverTime)
                  ? "expired"
                  : t.remaining === 0
                    ? "redeemed"
                    : "valid";
        return {
          id: t.id,
          occurrenceId: t.occurrenceId,
          resource: t.resource,
          label:
            occurrence?.resources.find((r) => r.id === t.resource)?.label ??
            t.resource,
          gate:
            occurrence?.resources.find((r) => r.id === t.resource)?.gate ??
            null,
          ordinal: t.ordinal,
          status,
          remaining: t.remaining,
          ...(status === "valid" && t.token ? { token: t.token } : {}),
        };
      });
      const expected = (order.snapshot.items ?? []).reduce(
        (n: number, i: any) => n + i.quantity,
        0,
      );
      return {
        orderId: id,
        bookingState: order.state,
        serverTime,
        issuance: (items.length < expected ? "pending" : "issued") as
          "pending" | "issued",
        occurrences: occurrences.map((o) => ({
          ...o,
          directionsUrl: venueDirections(
            o.venueName,
            o.venueAddress,
            o.venueCity,
          ),
          admissionOpensAt: new Date(
            Date.parse(o.startsAt) - 3600000,
          ).toISOString(),
          scheduleChanged: (order.snapshot.occurrences ?? []).some(
            (s: any) =>
              s.id === o.id &&
              (s.startsAt !== o.startsAt || s.endsAt !== o.endsAt),
          ),
        })),
        items,
        instructions: order.snapshot.quote?.policy?.admissionTerms ?? "",
      };
    });
  }
  async view(owner: string, id: string): Promise<WalletView> {
    const wallet = await this.read(owner, id, true);
    return {
      ...wallet,
      items: await Promise.all(
        wallet.items.map(async (t) => {
          const { token, ...ticket } = t;
          return {
            ...ticket,
            qrSvg: token ? await this.renderer.svg(token) : null,
          };
        }),
      ),
    };
  }
  async document(owner: string, id: string) {
    const wallet = await this.view(owner, id);
    if (wallet.bookingState !== "confirmed")
      throw new AppError(
        "BOOKING_NOT_CONFIRMED",
        "Ticket download requires a confirmed booking.",
        409,
      );
    return wallet;
  }
  async calendar(owner: string, id: string) {
    const wallet = await this.read(owner, id, false);
    if (wallet.bookingState !== "confirmed")
      throw new AppError(
        "BOOKING_NOT_CONFIRMED",
        "Calendar export requires a confirmed booking.",
        409,
      );
    if (!wallet.occurrences.length)
      throw new AppError(
        "CALENDAR_UNAVAILABLE",
        "Occurrence information is unavailable.",
        409,
      );
    return calendar(wallet.occurrences, wallet.serverTime);
  }
}
