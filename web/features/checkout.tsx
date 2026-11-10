import { customerCaseLink } from "./support-context.ts";
import { PaymentHistoryPanel } from "./payment-history.tsx";
import { BookingTimelinePanel } from "./booking-timeline.tsx";
import { OnlineEventAccess } from "./online-access.tsx";
import { BookingProgress } from "./booking-design.tsx";
import type { ReservedSnapshot } from "../../src/modules/inventory/contracts/index.ts";
import { FreeBookingCancellation } from "./free-cancellation.tsx";
import { FreeBookingConfirmation } from "./free-confirmation.tsx";
import { PendingOrderCancellation } from "./pending-cancellation.tsx";
import { TicketWallet } from "./tickets.tsx";
import {
  SavedRegistration,
  AttendeeFields,
  type RegistrationPreview,
} from "./registration.tsx";
import type { Answers } from "../../src/modules/events/contracts/index.ts";
import { PaymentPanel } from "./payment.tsx";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, money } from "../api.ts";
import type {
  Quote,
  PriceBreakdown,
} from "../../src/modules/pricing/contracts/index.ts";
export function QuoteTotals({ prices }: { prices: PriceBreakdown }) {
  return (
    <dl className="quote-totals">
      <div>
        <dt>Tickets, excluding tax</dt>
        <dd>{money(prices.ticketSubtotalPaise)}</dd>
      </div>
      <div>
        <dt>Booking fees, excluding tax</dt>
        <dd>{money(prices.feesPaise)}</dd>
      </div>
      <div>
        <dt>Taxes</dt>
        <dd>{money(prices.taxesPaise)}</dd>
      </div>
      <div>
        <dt>Add-ons</dt>
        <dd>{money(prices.extrasPaise)}</dd>
      </div>
      <div>
        <dt>Discount</dt>
        <dd>−{money(prices.discountPaise)}</dd>
      </div>
      <div className="quote-total">
        <dt>Total</dt>
        <dd>{money(prices.totalPaise)}</dd>
      </div>
    </dl>
  );
}
export function CheckoutQuote({
  reservationId,
  active,
}: {
  reservationId: string;
  active: boolean;
}) {
  const [quote, setQuote] = useState<Quote | null>(null),
    [accepted, setAccepted] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0);
  const [registration, setRegistration] = useState<RegistrationPreview | null>(
      null,
    ),
    [answers, setAnswers] = useState<Answers[]>([]);
  const key = useRef(crypto.randomUUID());
  const lastQuote = useRef<string | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setMessage("");
    Promise.all([
      api<Quote>("/quotes", {
        method: "POST",
        body: JSON.stringify({ reservationId }),
      }),
      api<RegistrationPreview>(
        `/reservations/${reservationId}/registration-form`,
      ),
    ])
      .then(([q, r]) => {
        if (!current) return;
        if (lastQuote.current !== q.id) {
          setAccepted(false);
          key.current = crypto.randomUUID();
        }
        setRegistration((previous) => {
          if (previous?.form?.id !== r.form?.id) {
            setAccepted(false);
            setAnswers([]);
            key.current = crypto.randomUUID();
          }
          return r;
        });
        lastQuote.current = q.id;
        setQuote(q);
      })
      .catch((e) => {
        if (current) {
          setQuote(null);
          setMessage(e.message);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [reservationId, revision]);
  async function submit() {
    if (!quote || !accepted || !active || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const order = await api<{ id: string }>("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({
          reservationId,
          quoteId: quote.id,
          acceptPolicies: accepted,
          ...(registration?.form?.definition.fields.length
            ? {
                registration: {
                  formId: registration.form.id,
                  answers: Array.from(
                    { length: registration.quantity },
                    (_, i) => answers[i] ?? {},
                  ),
                },
              }
            : {}),
        }),
      });
      location.assign(`/bookings/${order.id}`);
    } catch (e) {
      setMessage((e as Error).message);
      if (
        e instanceof ApiError &&
        [
          "FORM_CHANGED",
          "QUOTE_CHANGED",
          "QUOTE_EXPIRED",
          "RESERVATION_EXPIRED",
        ].includes(e.code)
      ) {
        setAccepted(false);
        setQuote(null);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="quote-panel checkout-review"
      aria-labelledby="quote-heading"
    >
      <h2 id="quote-heading">Booking summary</h2>
      {loading ? (
        <p role="status">Calculating your quote…</p>
      ) : quote ? (
        <>
          <section className="selected-session" aria-label="Selected sessions">
            <h3>Your selected session</h3>
            {(quote.reservationSnapshot as ReservedSnapshot).occurrences.map(
              (occurrence) => (
                <div key={occurrence.id}>
                  <strong>{occurrence.venueName}</strong>
                  <p>
                    {new Date(occurrence.startsAt).toLocaleString("en-IN", {
                      timeZone: occurrence.timeZone,
                    })}{" "}
                    –{" "}
                    {new Date(occurrence.endsAt).toLocaleTimeString("en-IN", {
                      timeZone: occurrence.timeZone,
                    })}{" "}
                    · {occurrence.timeZone}
                  </p>
                  <p>
                    {(quote.reservationSnapshot as ReservedSnapshot).items
                      .filter((item) => item.occurrence_id === occurrence.id)
                      .reduce((total, item) => total + item.quantity, 0)}{" "}
                    admission(s). Each ticket admits one person to this session.
                  </p>
                </div>
              ),
            )}
          </section>
          {registration && (
            <AttendeeFields
              allowSaved
              preview={registration}
              answers={answers}
              disabled={busy || !active}
              onChange={(a) => {
                setAnswers(a);
                key.current = crypto.randomUUID();
                setAccepted(false);
              }}
            />
          )}
          <div className="checkout-price-summary">
            <QuoteTotals prices={quote.prices} />
          </div>
          <p className="muted">
            Quote {quote.id.slice(0, 8)} · {quote.policyLabel}
          </p>
          <details>
            <summary>How charges are allocated</summary>
            <ul>
              {quote.prices.units.map((u) => (
                <li key={u.key}>
                  {u.resourceId}, admission {u.ordinal + 1}:{" "}
                  {money(u.totalPaise)}
                </li>
              ))}
            </ul>
          </details>
          <div className="policy-terms">
            <h3>Cancellation policy</h3>
            <p>{quote.policy.cancellationTerms}</p>
            <h3>Admission policy</h3>
            <p>{quote.policy.admissionTerms}</p>
          </div>
          <label className="policy-acceptance">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={!active || busy}
            />
            <span>
              I have reviewed and accept these cancellation and admission
              policies.
            </span>
          </label>
          <button
            className="primary"
            disabled={!accepted || !active || busy}
            onClick={submit}
          >
            {busy
              ? "Saving your order…"
              : `Continue · ${money(quote.prices.totalPaise)}`}
          </button>
          <p className="muted">
            This creates an order awaiting payment or free-booking confirmation.
            It does not charge you or confirm a booking.
          </p>
        </>
      ) : null}
      {message && (
        <div className="notice" role="alert">
          {message}
        </div>
      )}
      <button
        onClick={() => setRevision((r) => r + 1)}
        disabled={loading || busy || !active}
      >
        Refresh quote
      </button>
      {!active && (
        <p role="status">
          This hold is no longer active. Reserve again to continue.
        </p>
      )}
    </section>
  );
}
export function BookingDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setBusy(true);
    api(`/bookings/${id}`)
      .then((r) => {
        if (current) {
          setOrder(r);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [id, revision]);
  return (
    <section className="reading booking-status-page">
      <BookingProgress step={4} />
      <p className="eyebrow">YOUR ORDER</p>
      <h1>
        {order?.state === "confirmed" ? "Booking confirmed" : "Booking status"}
      </h1>
      {busy ? (
        <p role="status">Retrieving current status…</p>
      ) : error ? (
        <div className="notice" role="alert">
          {error}
        </div>
      ) : order ? (
        <>
          <p>Reference: {order.id}</p>
          <div className="notice" role="status">
            {order.state === "pending_payment"
              ? order.amount_paise === 0
                ? "Awaiting confirmation. No payment is required."
                : "Awaiting payment. This order is not a confirmed booking."
              : order.state === "refund_required"
                ? "Payment recovery requires review. A refund is not yet confirmed."
                : order.state}
          </div>
          {order.snapshot.occurrences?.map((o: any) => (
            <article key={o.id}>
              <h2>{o.venueName}</h2>
              <p>
                {new Date(o.startsAt).toLocaleString("en-IN", {
                  timeZone: o.timeZone,
                })}{" "}
                · {o.timeZone}
              </p>
            </article>
          ))}
          {order.snapshot.quote ? (
            <>
              <QuoteTotals prices={order.snapshot.quote.prices} />
              <details>
                <summary>Accepted policies</summary>
                <h3>Cancellation</h3>
                <p>{order.snapshot.quote.policy.cancellationTerms}</p>
                <h3>Admission</h3>
                <p>{order.snapshot.quote.policy.admissionTerms}</p>
                <p>
                  Accepted {new Date(order.accepted_at).toLocaleString("en-IN")}
                </p>
              </details>
            </>
          ) : (
            <p>Total: {money(order.amount_paise)}</p>
          )}
          <PendingOrderCancellation
            key={id}
            orderId={id}
            state={order.state}
            onChanged={() => setRevision((r) => r + 1)}
          />
          {order.amount_paise === 0 && order.state === "confirmed" && (
            <FreeBookingCancellation
              key={id}
              id={id}
              cutoff={
                order.snapshot.quote?.policy?.freeCancellationCutoffMinutes
              }
              onChanged={() => setRevision((r) => r + 1)}
            />
          )}
          {order.state === "confirmed" &&
            order.snapshot.occurrences?.map((o: any) => (
              <OnlineEventAccess
                key={`${o.id}:${revision}`}
                orderId={id}
                occurrenceId={o.id}
              />
            ))}
          <BookingTimelinePanel key={id} id={id} revision={revision} />
          <PaymentHistoryPanel key={id} id={id} revision={revision} />
          <SavedRegistration orderId={id} />
          <TicketWallet key={id} orderId={id} revision={revision} />
          {order.amount_paise === 0 ? (
            <FreeBookingConfirmation
              key={id}
              id={id}
              state={order.state}
              onConfirmed={() => setRevision((r) => r + 1)}
            />
          ) : (
            <PaymentPanel
              orderId={id}
              amountPaise={order.amount_paise}
              bookingState={order.state}
              onSettled={() => setRevision((r) => r + 1)}
            />
          )}
        </>
      ) : null}
      <button onClick={() => setRevision((r) => r + 1)} disabled={busy}>
        Check latest status
      </button>
      <p>
        <a href="/bookings">Back to My bookings</a> ·{" "}
        <a href={customerCaseLink({bookingId:id})}>Support for this booking</a>
      </p>
    </section>
  );
}
