import { useEffect, useRef, useState } from "react";
import { api, money } from "../api.ts";
type Preview = {
  allowed: boolean;
  previewId: string | null;
  expiresAt: string | null;
  serverTime: string;
  bookingState: string;
  paymentActivity: boolean;
  reason: string | null;
  consequence: string;
  recovery: { amountPaise: number; state: string; reason: string }[];
};
export function PendingOrderCancellation({
  orderId,
  state,
  onChanged,
}: {
  orderId: string;
  state: string;
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const operation = useRef({ body: "", key: crypto.randomUUID() }),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setPreview(null);
    setAck(false);
  }, [state, orderId]);
  async function review() {
    setBusy(true);
    setMessage("");
    setAck(false);
    try {
      const p = await api<Preview>(
        `/bookings/${orderId}/pending-cancellation/preview`,
        { method: "POST", body: "{}" },
      );
      if (mounted.current) setPreview(p);
    } catch (e) {
      if (mounted.current) setMessage((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function cancel() {
    if (!preview?.previewId || !ack) return;
    setBusy(true);
    setMessage("");
    const body = JSON.stringify({
      previewId: preview.previewId,
      reason,
      acknowledgePaymentRisk: ack,
    });
    if (operation.current.body !== body)
      operation.current = { body, key: crypto.randomUUID() };
    try {
      await api(`/bookings/${orderId}/pending-cancellation`, {
        method: "POST",
        headers: { "Idempotency-Key": operation.current.key },
        body,
      });
      if (mounted.current) {
        setPreview(null);
        setMessage(
          "The pending order is cancelled. This does not confirm a refund.",
        );
        setAck(false);
        onChanged();
      }
    } catch (e) {
      if (mounted.current) setMessage((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (!["pending_payment", "cancelled"].includes(state)) return null;
  return (
    <section className="quote-panel">
      <h2>
        {state === "cancelled"
          ? "Cancellation and payment recovery"
          : "Cancel this pending order"}
      </h2>
      <p>
        This action applies to orders awaiting booking confirmation. Confirmed
        ticket cancellation and refunds require their purchased-policy workflow.
      </p>
      <button disabled={busy} onClick={review}>
        {busy
          ? "Checking…"
          : state === "cancelled"
            ? "Check payment recovery"
            : "Review cancellation"}
      </button>
      {preview && (
        <>
          <p role="status">
            Current order status: {preview.bookingState}. Checked{" "}
            {new Date(preview.serverTime).toLocaleString("en-IN")}.
          </p>
          <p>{preview.consequence}</p>
          {preview.paymentActivity && (
            <p className="notice">
              Payment activity exists. A payment may already be underway;
              cancelling this order does not stop a bank transaction.
            </p>
          )}
          {preview.recovery.map((r, i) => (
            <p key={i} role="status">
              Payment recovery: {money(r.amountPaise)} · {r.state} · {r.reason}.
              A completed refund is not confirmed here.
            </p>
          ))}
          {!preview.recovery.length && state === "cancelled" && (
            <p>
              No refund-recovery record is currently available. Check payment
              status and contact support if you were charged.
            </p>
          )}
          {preview.allowed ? (
            <fieldset disabled={busy}>
              <legend>Confirm pending-order cancellation</legend>
              <p>
                Preview expires{" "}
                {new Date(preview.expiresAt!).toLocaleString("en-IN")}. No
                refund amount is being promised.
              </p>
              <label>
                Reason (do not include payment secrets)
                <textarea
                  maxLength={500}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setAck(false);
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I understand that this releases the hold, prevents booking
                fulfillment, and does not guarantee that a payment was stopped
                or refunded.
              </label>
              <button
                disabled={!ack || reason.trim().length < 5}
                onClick={cancel}
              >
                Cancel pending order
              </button>
            </fieldset>
          ) : (
            <p>
              {preview.reason === "ALREADY_CANCELLED"
                ? "This order is already cancelled."
                : "This order cannot use pending-order cancellation. Refresh booking status."}
            </p>
          )}
        </>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <p>
        <a href="/cases">Contact support about a charge</a>
      </p>
    </section>
  );
}
