import { useRef, useState } from "react";
import { api } from "../api.ts";
export function FreeBookingConfirmation({
  id,
  state,
  onConfirmed,
}: {
  id: string;
  state: string;
  onConfirmed: () => void;
}) {
  const key = useRef(crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function confirm() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api(`/bookings/${id}/free-confirmation`, {
        method: "POST",
        headers: { "idempotency-key": key.current },
        body: JSON.stringify({ confirm: true }),
      });
      setMessage(
        result.bookingState === "confirmed"
          ? "Your free booking is confirmed."
          : "The server returned an updated booking status.",
      );
      onConfirmed();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Free booking confirmation">
      <h2>No payment required</h2>
      <p>
        This order totals ₹0. Tickets are issued only after the server confirms
        your active reservation.
      </p>
      {state === "pending_payment" && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy ? "Confirming…" : "Confirm free booking"}
        </button>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
