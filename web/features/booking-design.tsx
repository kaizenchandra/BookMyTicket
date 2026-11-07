import { money } from "../api.ts";
export function BookingProgress({ step }: { step: number }) {
  return (
    <ol className="booking-progress" aria-label="Booking progress">
      {["Choose a show", "Select tickets", "Review details", "Payment"].map(
        (label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className={step >= index + 1 ? "reached" : ""}
          >
            <span aria-hidden="true">{index + 1}</span>
            {label}
          </li>
        ),
      )}
    </ol>
  );
}
type Resource = {
  id: string;
  label: string;
  kind: string;
  available: number;
  price_paise: number;
};
type Plan = {
  orientation: string;
  resources: {
    id: string;
    x: number;
    y: number;
    row: string;
    section: string;
    accessible: boolean;
    gate?: string;
  }[];
};
export function SeatSelection({
  resources,
  plan,
  selected,
  onChange,
  busy,
}: {
  resources: Resource[];
  plan?: Plan;
  selected: Record<string, number>;
  onChange: (id: string, n: number) => void;
  busy: boolean;
}) {
  const seats = resources.filter((r) => r.kind === "seat"),
    pools = resources.filter((r) => r.kind !== "seat");
  const renderSeat = (r: Resource) => {
    const info = plan?.resources.find((p) => p.id === r.id);
    return (
      <button
        type="button"
        key={r.id}
        className={`map-seat ${selected[r.id] ? "is-selected" : ""}`}
        disabled={busy || r.available < 1}
        aria-pressed={!!selected[r.id]}
        aria-label={`${r.label}${info?.accessible ? ", accessible" : ""}, ${money(r.price_paise)}, ${r.available < 1 ? "unavailable" : selected[r.id] ? "selected" : "available"}`}
        title={`${r.label} · ${money(r.price_paise)}`}
        onClick={() => onChange(r.id, selected[r.id] ? 0 : 1)}
      >
        {r.available < 1 ? <span aria-hidden="true">×</span> : r.label}
        {info?.accessible && (
          <span className="accessibility-mark" aria-hidden="true">
            ♿
          </span>
        )}
      </button>
    );
  };
  return (
    <>
      <div className="seat-legend" aria-label="Seat legend">
        <span>
          <i />
          Available
        </span>
        <span>
          <i className="chosen" />
          Selected
        </span>
        <span>
          <i className="unavailable" />
          Unavailable ×
        </span>
      </div>
      {!!seats.length && (
        <section className="seat-map-panel" aria-label="Choose your seats">
          {plan ? (
            <>
              <p className="muted">
                Scroll horizontally to explore the seating plan. An accessible
                list is also available below.
              </p>
              <div
                className="seat-map-scroll"
                tabIndex={0}
                aria-label="Scrollable seating plan"
              >
                <div className="seat-map-canvas">
                  {seats.map((r) => {
                    const p = plan.resources.find((p) => p.id === r.id);
                    return p ? (
                      <div
                        key={r.id}
                        className="map-position"
                        style={{
                          left: `${4 + p.x * 0.9}%`,
                          top: `${4 + p.y * 0.82}%`,
                        }}
                      >
                        {renderSeat(r)}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="cinema-screen">
                <span>{plan.orientation}</span>
              </div>
            </>
          ) : (
            <div className="seat-grid">{seats.map(renderSeat)}</div>
          )}
          <details className="accessible-seats">
            <summary>Select seats from an accessible list</summary>
            <div className="seat-grid">{seats.map(renderSeat)}</div>
          </details>
        </section>
      )}
      {!!pools.length && (
        <section className="admission-options" aria-label="Ticket categories">
          <h2>Select your tickets</h2>
          <p className="muted">
            One admission per ticket. Availability is confirmed when you
            reserve.
          </p>
          {pools.map((r) => {
            const info = plan?.resources.find((p) => p.id === r.id);
            return (
              <article className="admission-option" key={r.id}>
                <div>
                  <h3>{r.label}</h3>
                  <p>
                    {money(r.price_paise)}{" "}
                    <span className="muted">per person</span>
                  </p>
                  <small>
                    {r.available} available{info?.gate ? ` · ${info.gate}` : ""}
                    {info?.accessible ? " · Accessible" : ""}
                  </small>
                </div>
                <div className="quantity-control">
                  <button
                    disabled={busy || !selected[r.id]}
                    aria-label={`Remove one ${r.label} ticket`}
                    onClick={() =>
                      onChange(r.id, Math.max(0, (selected[r.id] ?? 0) - 1))
                    }
                  >
                    −
                  </button>
                  <output aria-label={`${r.label} quantity`}>
                    {selected[r.id] ?? 0}
                  </output>
                  <button
                    disabled={
                      busy || (selected[r.id] ?? 0) >= Math.min(8, r.available)
                    }
                    aria-label={`Add one ${r.label} ticket`}
                    onClick={() => onChange(r.id, (selected[r.id] ?? 0) + 1)}
                  >
                    +
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
