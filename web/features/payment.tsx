import { useEffect, useRef, useState } from "react";
import { api, money } from "../api.ts";
type Status = {
  bookingState: string;
  paymentState: string;
  serverTime: string;
  checkedAt: string | null;
  attempts: { state: string; amount_paise: number; observed_at: string }[];
  allowedActions: { initiate: boolean; reason: string | null };
};
type ProviderResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type ProviderCheckout = {
  open(): void;
  close(): void;
  on(name: string, handler: () => void): void;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => ProviderCheckout;
  }
}
let scriptPromise: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      const timeout = setTimeout(() => {
        script.remove();
        scriptPromise = undefined;
        reject(
          new Error("Payment checkout could not load. Check your connection."),
        );
      }, 15000);
      script.onload = () => {
        clearTimeout(timeout);
        if (window.Razorpay) resolve();
        else {
          script.remove();
          scriptPromise = undefined;
          reject(
            new Error(
              "Razorpay checkout did not initialize. Retry loading checkout.",
            ),
          );
        }
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        scriptPromise = undefined;
        reject(
          new Error(
            "Payment checkout is unavailable. No payment was confirmed.",
          ),
        );
      };
      document.head.append(script);
    });
  return scriptPromise;
}
export function PaymentPanel({
  orderId,
  amountPaise,
  bookingState,
  onSettled,
}: {
  orderId: string;
  amountPaise: number;
  bookingState: string;
  onSettled: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const mounted = useRef(true),
    checkout = useRef<ProviderCheckout | null>(null),
    refreshRef = useRef<() => Promise<void>>(async () => {}),
    settled = useRef(onSettled);
  settled.current = onSettled;
  useEffect(() => {
    mounted.current = true;
    let controller = new AbortController();
    let lastBooking = bookingState;
    async function refresh() {
      try {
        const next = await api<Status>(`/bookings/${orderId}/payment`, {
          signal: controller.signal,
        });
        if (!mounted.current) return;
        setStatus(next);
        if (next.bookingState !== lastBooking) {
          lastBooking = next.bookingState;
          settled.current();
        }
      } catch (error) {
        if (mounted.current && !controller.signal.aborted)
          setMessage((error as Error).message);
      }
    }
    refreshRef.current = refresh;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    return () => {
      mounted.current = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      checkout.current?.close();
    };
  }, [orderId]);
  async function recover() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{ state: string }>(
        `/bookings/${orderId}/payment/reconcile`,
        { method: "POST", body: "{}" },
      );
      if (mounted.current)
        setMessage(
          result.state === "queued"
            ? "Payment verification queued. Keep this page open or return to your booking later. Do not pay again."
            : "Payment verification is already pending. Do not pay again.",
        );
    } catch (error) {
      if (mounted.current) setMessage((error as Error).message);
    } finally {
      if (mounted.current) {
        setBusy(false);
        void refreshRef.current();
      }
    }
  }
  async function pay() {
    if (busy || !status?.allowedActions.initiate) return;
    setBusy(true);
    setMessage("");
    try {
      await loadCheckout();
      const prepared = await api<{
        key: string;
        providerOrderId: string;
        amountPaise: number;
        currency: string;
      }>(`/bookings/${orderId}/payment`, { method: "POST", body: "{}" });
      if (!mounted.current) return;
      if (!window.Razorpay)
        throw new Error(
          "Checkout could not load. Check status before retrying.",
        );
      const finish = () => {
        if (mounted.current) {
          setBusy(false);
          void refreshRef.current();
        }
      };
      const instance = new window.Razorpay({
        key: prepared.key,
        order_id: prepared.providerOrderId,
        amount: prepared.amountPaise,
        currency: prepared.currency,
        name: "BookMyTicket",
        description: "Ticket booking",
        theme: {
          color:
            document.documentElement.dataset.theme === "DARK"
              ? "#ff708d"
              : "#c92d50",
        },
        retry: { enabled: false },
        modal: {
          ondismiss: () => {
            if (mounted.current)
              setMessage(
                "Checkout closed. We are checking the payment outcome; closure does not confirm cancellation.",
              );
            finish();
          },
        },
        handler: async (result: ProviderResult) => {
          try {
            await api(`/bookings/${orderId}/payment/callback`, {
              method: "POST",
              body: JSON.stringify({
                providerOrderId: result.razorpay_order_id,
                paymentId: result.razorpay_payment_id,
                signature: result.razorpay_signature,
              }),
            });
            if (mounted.current)
              setMessage(
                "Payment response received. Booking confirmation depends on verified payment and inventory.",
              );
          } catch (error) {
            if (mounted.current)
              setMessage(
                (error as Error).message +
                  " Status recovery continues independently.",
              );
          } finally {
            finish();
          }
        },
      });
      checkout.current = instance;
      instance.on("payment.failed", () => {
        if (mounted.current)
          setMessage(
            "The payment attempt needs a status check. A retry is offered only after the server verifies failure.",
          );
        finish();
      });
      instance.open();
    } catch (error) {
      if (mounted.current) {
        setMessage((error as Error).message);
        setBusy(false);
        void refreshRef.current();
      }
    }
  }
  return (
    <section className="quote-panel" aria-labelledby="payment-heading">
      <h2 id="payment-heading">Payment</h2>
      {!status ? (
        <p role="status">Retrieving payment status…</p>
      ) : (
        <>
          <p role="status">
            Payment: {status.paymentState.replaceAll("_", " ")}. Booking:{" "}
            {status.bookingState.replaceAll("_", " ")}.
          </p>
          {status.attempts.length > 0 && (
            <ul>
              {status.attempts.map((a, i) => (
                <li key={i}>
                  {a.state} · {money(a.amount_paise)} ·{" "}
                  {new Date(a.observed_at).toLocaleString("en-IN")}
                </li>
              ))}
            </ul>
          )}
          {status.checkedAt && (
            <p className="muted">
              Provider last checked{" "}
              {new Date(status.checkedAt).toLocaleString("en-IN")}
            </p>
          )}
          {status.allowedActions.initiate ? (
            <button className="primary" disabled={busy} onClick={pay}>
              {busy
                ? "Checking payment…"
                : status.attempts.length
                  ? "Retry verified failed payment"
                  : `Pay ${money(amountPaise)} with Razorpay`}
            </button>
          ) : (
            <p>
              {status.bookingState === "confirmed"
                ? "Your booking is confirmed. No further payment is required."
                : status.bookingState === "refund_required"
                  ? "Payment recovery is under review. A refund is not yet confirmed; contact support for assistance."
                  : status.bookingState === "cancelled"
                    ? "This booking is cancelled. Payment and refund status remain separate."
                    : status.allowedActions.reason === "PAYMENTS_UNAVAILABLE"
                      ? "Payment collection is currently unavailable. No payment has been requested by this page."
                      : "Do not pay again while the existing payment is unresolved. Check status or contact support."}
            </p>
          )}
          <p className="muted">
            UPI and credit/debit cards appear when enabled for the merchant.
            Razorpay controls its secure checkout appearance.
          </p>
        </>
      )}
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      <button disabled={busy} onClick={() => void refreshRef.current()}>
        Refresh saved status
      </button>
      {status &&
        !["not_started", "not_required"].includes(status.paymentState) && (
          <button disabled={busy} onClick={() => void recover()}>
            Check payment with Razorpay
          </button>
        )}
    </section>
  );
}
