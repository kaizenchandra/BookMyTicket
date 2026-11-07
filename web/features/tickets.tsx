import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import type { WalletView as Wallet } from "../../src/modules/bookings/contracts/wallet.ts";
export function TicketWallet({
  orderId,
  revision,
}: {
  orderId: string;
  revision: number;
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setWallet(null);
    api<Wallet>(`/bookings/${orderId}/tickets`)
      .then((w) => {
        if (current) {
          setWallet(w);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [orderId, revision, refresh]);
  useEffect(() => {
    const update = () => setRefresh((r) => r + 1);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  async function download(kind: "tickets/download" | "calendar") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/bookings/${orderId}/${kind}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message ?? "Download unavailable.");
      }
      const blob = await response.blob();
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download =
        kind === "calendar"
          ? `booking-${orderId}.ics`
          : `tickets-${orderId}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="ticket-wallet" aria-label="Your admission tickets">
      <h2>Your tickets</h2>
      {loading && <p role="status">Checking ticket status…</p>}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {wallet && (
        <>
          {wallet.bookingState !== "confirmed" ? (
            <p>No confirmed admission tickets are available for this order.</p>
          ) : (
            <>
              <p className="muted">
                Last synchronized{" "}
                {new Date(wallet.serverTime).toLocaleString("en-IN")}. Admission
                requires current server verification.
              </p>
              {wallet.issuance === "pending" && (
                <p role="status">
                  Your booking is confirmed. Some tickets are still being
                  issued; refresh to check progress.
                </p>
              )}
              <p>{wallet.instructions}</p>
              <div className="ticket-grid">
                {wallet.items.map((t) => {
                  const o = wallet.occurrences.find(
                    (o) => o.id === t.occurrenceId,
                  );
                  return (
                    <article className="admission-ticket" key={t.id}>
                      <h3>{o?.venueName ?? "Venue unavailable"}</h3>
                      {o && (
                        <>
                          <p>
                            {new Date(o.startsAt).toLocaleString("en-IN", {
                              timeZone: o.timeZone,
                            })}{" "}
                            · {o.timeZone}
                          </p>
                          {o.scheduleChanged && (
                            <p role="status">
                              The schedule has changed since booking. These are
                              the current occurrence times.
                            </p>
                          )}
                          <p className="muted">
                            Admission window:{" "}
                            {new Date(o.admissionOpensAt).toLocaleString(
                              "en-IN",
                              { timeZone: o.timeZone },
                            )}{" "}
                            –{" "}
                            {new Date(o.endsAt).toLocaleString("en-IN", {
                              timeZone: o.timeZone,
                            })}
                            . Current development policy: opens one hour before
                            start.
                          </p>
                        </>
                      )}
                      <p>
                        Seat/category: <strong>{t.label}</strong> · Admission{" "}
                        {t.ordinal + 1}
                      </p>
                      <p>
                        Gate:{" "}
                        {t.gate || "Not specified; check venue instructions"}
                      </p>
                      <p>
                        <strong>{t.status}</strong> · remaining entries:{" "}
                        {t.remaining}
                      </p>
                      {t.qrSvg ? (
                        <img
                          className="ticket-qr"
                          width="256"
                          height="256"
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(t.qrSvg)}`}
                          alt={`Admission QR code for ticket ${t.id}`}
                        />
                      ) : (
                        <p>No active QR code for this ticket.</p>
                      )}
                      <p className="ticket-reference">Ticket ID: {t.id}</p>
                    </article>
                  );
                })}
              </div>
              <div className="ticket-actions">
                <button
                  disabled={busy || loading}
                  onClick={() => download("tickets/download")}
                >
                  Download printable tickets
                </button>
                <button
                  disabled={busy || loading}
                  onClick={() => download("calendar")}
                >
                  Add to calendar (.ics)
                </button>
              </div>
              <p className="muted">
                Open the downloaded ticket file and use your browser’s Print
                command. Saved tickets reflect the displayed synchronization
                time and do not guarantee current validity. Calendar imports do
                not automatically update when a schedule changes.
              </p>
            </>
          )}
        </>
      )}
      <button
        disabled={loading || busy}
        onClick={() => setRefresh((r) => r + 1)}
      >
        Refresh tickets
      </button>
    </section>
  );
}
