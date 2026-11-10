import React, { useEffect, useState, useRef } from "react";
import { api, ApiError } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { dashboardMoney } from "./admin-money.ts";
import type {
  Room,
  Plan,
  Night,
} from "../../src/modules/inventory/application/hotel.ts";
type ClientRoom = Room & { plans: Plan[] };
function errorText(e: unknown) {
  return e instanceof ApiError
    ? e.message +
        " " +
        (e.fields ?? [])
          .map((f) => f.path.join(".") + ": " + f.message)
          .join("; ")
    : (e as Error).message;
}
function useData<T>(path: string, revision: number) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    if (path)
      api<T>(path, { signal: c.signal })
        .then((d) => {
          if (!c.signal.aborted) setData(d);
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(errorText(e));
        });
    return () => c.abort();
  }, [path, revision]);
  return { data, error };
}
function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
  min,
  max,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={min}
        max={max}
      />
    </label>
  );
}
function Mutation({
  title,
  path,
  method = "POST",
  body,
  children,
  onSaved,
}: {
  title: string;
  path: string;
  method?: string;
  body: (f: FormData) => unknown;
  children: React.ReactNode;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    request = useRef({ key: crypto.randomUUID(), body: "" });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const payload = JSON.stringify(body(new FormData(e.currentTarget)));
        if (request.current.body && request.current.body !== payload)
          request.current.key = crypto.randomUUID();
        request.current.body = payload;
        setBusy(true);
        setError("");
        try {
          await api(path, {
            method,
            headers: { "Idempotency-Key": request.current.key },
            body: payload,
          });
          onSaved();
        } catch (e) {
          setError(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{title}</h3>
      {children}
      <Field name="reason" label="Reason (at least 10 characters)" />
      <label>
        <input type="checkbox" required />I confirm this inventory/configuration
        change.
      </label>
      <button disabled={busy}>{busy ? "Saving…" : title}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
const num = (f: FormData, k: string) => Number(f.get(k)),
  str = (f: FormData, k: string) => String(f.get(k) ?? ""),
  checked = (f: FormData, k: string) => f.get(k) === "on";
function PlanForm({
  room,
  plan,
  onSaved,
}: {
  room: ClientRoom;
  plan?: Plan;
  onSaved: () => void;
}) {
  return (
    <Mutation
      title={plan ? "Save rate plan" : "Add rate plan"}
      path={`/admin/hotel-rooms/${room.id}/plans${plan ? "/" + plan.id : ""}`}
      method={plan ? "PATCH" : "POST"}
      onSaved={onSaved}
      body={(f) => ({
        name: str(f, "name"),
        refundable: checked(f, "refundable"),
        policy: str(f, "policy"),
        basePaise: str(f, "base"),
        includedGuests: num(f, "included"),
        extraGuestPaise: str(f, "extra"),
        minStay: num(f, "min"),
        active: checked(f, "active"),
        expectedVersion: room.version,
        ...(plan ? { planVersion: plan.version } : {}),
        reason: str(f, "reason"),
      })}
    >
      <Field name="name" label="Rate-plan name" value={plan?.name} />
      <label>
        <input
          type="checkbox"
          name="refundable"
          defaultChecked={plan?.refundable}
        />
        Refundable
      </label>
      <label>
        Refund/cancellation policy
        <textarea
          name="policy"
          required
          minLength={10}
          maxLength={3000}
          defaultValue={plan?.policy}
        />
      </label>
      <Field
        name="base"
        label="Default nightly base price (INR paise)"
        value={plan?.base_paise ?? "0"}
      />
      <Field
        name="included"
        label="Included guests per room"
        type="number"
        min={1}
        max={room.max_guests}
        value={plan?.included_guests ?? 1}
      />
      <Field
        name="extra"
        label="Extra guest price per night (paise)"
        value={plan?.extra_guest_paise ?? "0"}
      />
      <Field
        name="min"
        label="Default minimum stay (nights)"
        type="number"
        min={1}
        max={60}
        value={plan?.min_stay ?? 1}
      />
      <label>
        <input
          type="checkbox"
          name="active"
          defaultChecked={plan?.active ?? true}
        />
        Active
      </label>
      <p>
        Existing date overrides and held quotes retain their saved terms.
        Default prices apply only where no date override exists.
      </p>
    </Mutation>
  );
}
function Allocations({
  room,
  revision,
  manage,
  reload,
}: {
  room: string;
  revision: number;
  manage: boolean;
  reload: () => void;
}) {
  const [before, setBefore] = useState<string>(),
    { data, error } = useData<{
      items: {
        id: string;
        effective_state: string;
        expires_at: string;
        check_in: string;
        check_out: string;
        quantity: number;
        guests_per_room: number;
        quote: { totalPaise: string; refundable: boolean; policy: string };
      }[];
      nextBefore: string | null;
    }>(
      `/admin/hotel-rooms/${room}/allocations${before ? "?before=" + before : ""}`,
      revision,
    );
  return (
    <section>
      <h3>Inventory allocations</h3>
      <p>
        Holds expire after ten minutes. Reserved allocations consume capacity
        but do not create a paid booking or payment. Release only after
        confirming the allocation is no longer required.
      </p>
      {error && <p role="alert">{error}</p>}
      {data?.items.map((a) => (
        <details key={a.id}>
          <summary>
            {a.check_in} → {a.check_out} · {a.quantity} room(s) ·{" "}
            {a.effective_state} · {dashboardMoney(a.quote.totalPaise)}
          </summary>
          <p>
            {a.id} · {a.guests_per_room} guest(s) per room · Hold expiry{" "}
            {new Date(a.expires_at).toLocaleString()}
          </p>
          <p>
            {a.quote.refundable ? "Refundable" : "Non-refundable"}:{" "}
            {a.quote.policy}
          </p>
          {manage && ["held", "reserved"].includes(a.effective_state) && (
            <Mutation
              title="Apply allocation action"
              path={`/admin/hotel-rooms/${room}/allocations/${a.id}/actions`}
              onSaved={reload}
              body={(f) => ({
                action: str(f, "action"),
                reason: str(f, "reason"),
              })}
            >
              <label>
                Action
                <select name="action">
                  {a.effective_state === "held" && (
                    <option value="reserve">
                      Confirm inventory allocation (no booking/payment)
                    </option>
                  )}
                  <option value="release">Release rooms</option>
                </select>
              </label>
            </Mutation>
          )}
        </details>
      ))}
      {data && !data.items.length && <p>No allocations.</p>}
      <button disabled={!before} onClick={() => setBefore(undefined)}>
        Latest allocations
      </button>{" "}
      <button
        disabled={!data?.nextBefore}
        onClick={() => setBefore(data!.nextBefore!)}
      >
        Older allocations
      </button>
    </section>
  );
}
function Changes({ room, revision }: { room: string; revision: number }) {
  const [before, setBefore] = useState<string>(),
    { data, error } = useData<{
      items: {
        id: string;
        action: string;
        reason: string;
        created_at: string;
        details: unknown;
      }[];
      nextBefore: string | null;
    }>(
      `/admin/hotel-rooms/${room}/history${before ? "?before=" + before : ""}`,
      revision,
    );
  return (
    <section>
      <h3>Inventory change history</h3>
      {error && <p role="alert">{error}</p>}
      {data?.items.map((h) => (
        <details key={h.id}>
          <summary>
            {h.action} · {new Date(h.created_at).toLocaleString()}
          </summary>
          <p>{h.reason}</p>
          <pre>{JSON.stringify(h.details, null, 2)}</pre>
        </details>
      ))}
      <button disabled={!before} onClick={() => setBefore(undefined)}>
        Latest changes
      </button>{" "}
      <button
        disabled={!data?.nextBefore}
        onClick={() => setBefore(data!.nextBefore!)}
      >
        Older changes
      </button>
    </section>
  );
}
function Calendar({
  room,
  plan,
  manage,
  pricing,
  revision,
  reload,
}: {
  room: ClientRoom;
  plan: Plan;
  manage: boolean;
  pricing: boolean;
  revision: number;
  reload: () => void;
}) {
  const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    }),
    [range, setRange] = useState({
      from: today,
      until: new Date(Date.parse(today) + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
    }),
    { data, error } = useData<{ room: Room; nights: Night[] }>(
      `/admin/hotel-rooms/${room.id}/calendar?planId=${plan.id}&from=${range.from}&until=${range.until}`,
      revision,
    );
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setRange({ from: str(f, "from"), until: str(f, "until") });
        }}
      >
        <h3>Availability calendar · IST · INR</h3>
        <Field
          name="from"
          label="From / check-in"
          type="date"
          value={range.from}
        />
        <Field
          name="until"
          label="Until / check-out (exclusive)"
          type="date"
          value={range.until}
        />
        <button>Show calendar</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {data && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Night</th>
                <th>Capacity</th>
                <th>Held + reserved</th>
                <th>Available</th>
                <th>Base rate</th>
                <th>Discount</th>
                <th>Restrictions</th>
              </tr>
            </thead>
            <tbody>
              {data.nights.map((n) => (
                <tr key={n.day}>
                  <th>
                    {n.day}{" "}
                    {new Date(n.day + "T00:00:00Z").toLocaleDateString(
                      "en-IN",
                      { weekday: "short", timeZone: "UTC" },
                    )}
                  </th>
                  <td>{n.capacity ?? "Not configured"}</td>
                  <td>{n.used}</td>
                  <td>
                    {n.capacity === null
                      ? "Unavailable"
                      : n.stop_sell || n.blackout
                        ? 0
                        : Math.max(0, n.capacity - n.used)}
                  </td>
                  <td>{dashboardMoney(n.base_paise)}</td>
                  <td>{n.discount_bps / 100}%</td>
                  <td>
                    {n.min_stay} night minimum{" "}
                    {n.stop_sell ? " · Stop sell" : ""}
                    {n.blackout ? " · Blackout" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p>
        Capacity and stop-sell/blackout apply to every rate plan for this room
        type. Rate overrides apply only to the selected plan. Availability
        refreshes on Reload; the server rechecks it when holding rooms.
      </p>
      {manage && pricing && data && (
        <Mutation
          key={"bulk" + data.room.version + range.from + range.until}
          title="Bulk update dates"
          method="PUT"
          path={`/admin/hotel-rooms/${room.id}/calendar`}
          onSaved={reload}
          body={(f) => ({
            from: range.from,
            until: range.until,
            planId: plan.id,
            expectedVersion: data.room.version,
            capacity: num(f, "capacity"),
            stopSell: checked(f, "stop"),
            blackout: checked(f, "blackout"),
            basePaise: str(f, "base"),
            discountBps: num(f, "discount"),
            minStay: num(f, "min"),
            reason: str(f, "reason"),
          })}
        >
          <p>
            Replaces inventory and selected-plan rates on every displayed date,
            including existing overrides.
          </p>
          <Field
            name="capacity"
            label="Total rooms per night (not additional rooms)"
            type="number"
            min={0}
            max={10000}
          />
          <Field
            name="base"
            label="Seasonal/date nightly base rate (paise)"
            value={plan.base_paise}
          />
          <Field
            name="discount"
            label="Date promotion discount (basis points; 100 = 1%)"
            type="number"
            min={0}
            max={10000}
            value={0}
          />
          <Field
            name="min"
            label="Minimum stay"
            type="number"
            min={1}
            max={60}
            value={plan.min_stay}
          />
          <label>
            <input type="checkbox" name="stop" />
            Stop sell
          </label>
          <label>
            <input type="checkbox" name="blackout" />
            Blackout
          </label>
        </Mutation>
      )}
      {manage && data && (
        <Mutation
          title="Record reconciliation observation"
          path={`/admin/hotel-rooms/${room.id}/reconciliation`}
          onSaved={reload}
          body={(f) => ({
            from: range.from,
            until: range.until,
            planId: plan.id,
            expectedVersion: data.room.version,
            observedCapacity: num(f, "observed"),
            reason: str(f, "reason"),
          })}
        >
          <Field
            name="observed"
            label="Observed physical capacity per displayed night"
            type="number"
            min={0}
            max={10000}
          />
          <p>
            Records differences in history without changing inventory. Use a
            reviewed bulk update to correct configured capacity.
          </p>
        </Mutation>
      )}
      {manage && (
        <Mutation
          title="Create 10-minute hold"
          path={`/admin/hotel-rooms/${room.id}/holds`}
          onSaved={reload}
          body={(f) => ({
            planId: plan.id,
            checkIn: str(f, "in"),
            checkOut: str(f, "out"),
            quantity: num(f, "quantity"),
            guestsPerRoom: num(f, "guests"),
            reason: str(f, "reason"),
          })}
        >
          <Field name="in" label="Check-in" type="date" value={range.from} />
          <Field name="out" label="Check-out" type="date" value={range.until} />
          <Field
            name="quantity"
            label="Rooms"
            type="number"
            min={1}
            max={20}
            value={1}
          />
          <Field
            name="guests"
            label="Guests per room (all ages count)"
            type="number"
            min={1}
            max={room.max_guests}
            value={plan.included_guests}
          />
          <p>
            Requires a published property. Includes extra-guest pricing and date
            discount, rounded half up per room/night. No checkout, tax engine or
            payment is invoked.
          </p>
        </Mutation>
      )}
    </>
  );
}
export function HotelInventoryPage({ property }: { property: string }) {
  const grants = useAdminCapabilities(),
    manage = grants.includes("hotels.manage"),
    pricing = grants.includes("pricing"),
    [revision, setRevision] = useState(0),
    [roomId, setRoomId] = useState(""),
    [planId, setPlanId] = useState(""),
    { data, error } = useData<{ items: ClientRoom[] }>(
      "/admin/hotels/" + property + "/rooms",
      revision,
    ),
    room = data?.items.find((r) => r.id === roomId) ?? data?.items[0],
    plan = room?.plans.find((p) => p.id === planId) ?? room?.plans[0],
    reload = () => setRevision((n) => n + 1);
  return (
    <section className="admin-workspace">
      <AdminNavigation />
      <a href={"/admin/hotels/" + property}>Property details</a>
      <h1>Room inventory & rates</h1>
      <p>
        Operator-managed inventory. Channel-manager synchronization is not
        configured.
      </p>
      <button onClick={reload}>Reload availability</button>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data && (
        <>
          <label>
            Room type
            <select
              value={room?.id ?? ""}
              onChange={(e) => {
                setRoomId(e.target.value);
                setPlanId("");
              }}
            >
              {data.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          {manage && (
            <details>
              <summary>Add room type</summary>
              <Mutation
                title="Create room type"
                path={`/admin/hotels/${property}/rooms`}
                onSaved={reload}
                body={(f) => ({
                  code: str(f, "code"),
                  name: str(f, "name"),
                  maxGuests: num(f, "guests"),
                  reason: str(f, "reason"),
                })}
              >
                <Field
                  name="code"
                  label="Unique room code (lowercase letters, digits, hyphen)"
                />
                <Field name="name" label="Room type name" />
                <Field
                  name="guests"
                  label="Maximum guests per room"
                  type="number"
                  min={1}
                  max={20}
                  value={2}
                />
              </Mutation>
            </details>
          )}
          {!room && <p>Add a room type to start.</p>}
          {room && (
            <>
              <h2>{room.name}</h2>
              <p>
                Maximum {room.max_guests} guests per room · Version{" "}
                {room.version}
              </p>
              {manage && (
                <details>
                  <summary>Edit room type</summary>
                  <Mutation
                    key={room.id + room.version}
                    title="Save room type"
                    path={`/admin/hotel-rooms/${room.id}`}
                    method="PATCH"
                    onSaved={reload}
                    body={(f) => ({
                      name: str(f, "name"),
                      maxGuests: num(f, "guests"),
                      active: checked(f, "active"),
                      expectedVersion: room.version,
                      reason: str(f, "reason"),
                    })}
                  >
                    <Field
                      name="name"
                      label="Room type name"
                      value={room.name}
                    />
                    <Field
                      name="guests"
                      label="Maximum guests"
                      type="number"
                      min={1}
                      max={20}
                      value={room.max_guests}
                    />
                    <label>
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={room.active}
                      />
                      Active
                    </label>
                  </Mutation>
                </details>
              )}
              <label>
                Rate plan
                <select
                  value={plan?.id ?? ""}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  {room.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ·{" "}
                      {p.refundable ? "Refundable" : "Non-refundable"}
                      {p.active ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </label>
              {pricing && (
                <details>
                  <summary>Add rate plan</summary>
                  <PlanForm
                    key={"new" + room.id + room.version}
                    room={room}
                    onSaved={reload}
                  />
                </details>
              )}
              {plan ? (
                <>
                  <p>{plan.policy}</p>
                  {pricing && (
                    <details>
                      <summary>Edit selected rate plan</summary>
                      <PlanForm
                        key={plan.id + ":" + room.version}
                        room={room}
                        plan={plan}
                        onSaved={reload}
                      />
                    </details>
                  )}
                  <Calendar
                    key={room.id + plan.id}
                    room={room}
                    plan={plan}
                    manage={manage}
                    pricing={pricing}
                    revision={revision}
                    reload={reload}
                  />
                </>
              ) : (
                <p>Add a rate plan, then configure nightly inventory.</p>
              )}
              <Allocations
                key={"a" + room.id}
                room={room.id}
                revision={revision}
                manage={manage}
                reload={reload}
              />
              <Changes key={"h" + room.id} room={room.id} revision={revision} />
            </>
          )}
        </>
      )}
    </section>
  );
}
