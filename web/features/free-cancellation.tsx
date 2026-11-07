import { useState, useRef } from "react";
import { api } from "../api.ts";
export function FreeBookingCancellation({
  id,
  cutoff,
  onChanged,
}: {
  id: string;
  cutoff?: number;
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    operation = useRef({ body: "", key: crypto.randomUUID() });
  async function review() {
    setBusy(true);
    setMessage("");
    setAck(false);
    setPreview(null);
    try {
      setPreview(
        await api(`/bookings/${id}/free-cancellation/preview`, {
          method: "POST",
          body: "{}",
        }),
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setMessage("");
    const body = JSON.stringify({
      previewId: preview.previewId,
      reason,
      confirm: ack,
    });
    if (operation.current.body !== body)
      operation.current = { body, key: crypto.randomUUID() };
    try {
      await api(`/bookings/${id}/free-cancellation`, {
        method: "POST",
        body,
        headers: { "idempotency-key": operation.current.key },
      });
      setMessage("Free booking cancelled. Tickets revoked; no refund is due.");
      setPreview(null);
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Cancel free booking</h2>
      {cutoff === undefined ? (
        <p>
          The accepted policy does not permit cancellation of this confirmed
          free booking.
        </p>
      ) : (
        <>
          <p>
            Full cancellation only, before the event’s {cutoff}-minute cutoff.
            All tickets must be unused.
          </p>
          <button disabled={busy} onClick={() => void review()}>
            Review cancellation
          </button>
          {preview && (
            <>
              <p>{preview.consequence}</p>
              <ul>
                {preview.items.map((i: any) => (
                  <li key={`${i.occurrenceId}:${i.resourceId}`}>
                    {i.label} × {i.quantity}
                  </li>
                ))}
              </ul>
              <p>
                Refund: ₹0 · Preview expires{" "}
                {new Date(preview.expiresAt).toLocaleString("en-IN")}
              </p>
              <label>
                Reason
                <input
                  minLength={5}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />{" "}
                Cancel all tickets in this free booking
              </label>
              <button
                disabled={busy || !ack || reason.trim().length < 5}
                onClick={() => void cancel()}
              >
                Confirm cancellation
              </button>
            </>
          )}
        </>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
