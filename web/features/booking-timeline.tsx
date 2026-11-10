import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { BookingTimelinePage } from "../../src/modules/bookings/adapters/timeline-schema.ts";
const labels = {
  created: "Booking order created",
  policies_accepted: "Booking policies accepted",
  confirmed: "Booking confirmed",
  pending_cancelled: "Pending order cancelled",
  free_cancelled: "Free booking cancelled",
};
export function BookingMilestones({
  items,
}: Pick<BookingTimelinePage, "items">) {
  return (
    <ol>
      {items.map((item) => (
        <li key={item.kind}>
          <strong>{labels[item.kind]}</strong>
          {" — "}
          <time dateTime={item.occurredAt}>
            {new Date(item.occurredAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            (India time)
          </time>
        </li>
      ))}
    </ol>
  );
}
export function BookingTimelinePanel({
  id,
  revision,
}: {
  id: string;
  revision: number;
}) {
  const [page, setPage] = useState<BookingTimelinePage | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setPage(null);
    setError("");
    api<BookingTimelinePage>(`/bookings/${encodeURIComponent(id)}/timeline`)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, revision, refresh]);
  return (
    <section aria-label="Booking timeline">
      <h2>Booking timeline</h2>
      <p>
        Recorded booking milestones only. Creating an order does not confirm it.
        Payment records appear separately below. Full refund and disruption
        history is not included here; check the current booking and payment
        status for available actions.
      </p>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setRefresh((v) => v + 1)}>
            Retry timeline
          </button>
        </>
      ) : !page ? (
        <p role="status">Loading timeline…</p>
      ) : (
        <>
          <BookingMilestones items={page.items} />
          <p>
            Retrieved{" "}
            {new Date(page.serverTime).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            (India time). Missing historical milestones are not inferred from
            current status.
          </p>
          <button onClick={() => setRefresh((v) => v + 1)}>
            Refresh timeline
          </button>
        </>
      )}
    </section>
  );
}
