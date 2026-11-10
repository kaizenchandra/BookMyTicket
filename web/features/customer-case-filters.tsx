import type { SyntheticEvent } from "react";
import { customerCaseLink } from "./support-context.ts";
export function CustomerCaseFiltersForm({
  bookingId,
  state,
  category,
  onNavigate,
}: {
  bookingId?: string | null;
  state?: string | null;
  category?: string | null;
  onNavigate: (event: SyntheticEvent) => void;
}) {
  return (
    <form
      action="/cases"
      method="get"
      onSubmit={onNavigate}
      aria-label="Filter support cases"
    >
      {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
      <label>
        Case status
        <select name="state" defaultValue={state ?? ""}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <label>
        Case category
        <select name="category" defaultValue={category ?? ""}>
          <option value="">All categories</option>
          <option value="booking">Booking</option>
          <option value="payment">Payment</option>
          <option value="accessibility">Accessibility</option>
          <option value="other">Other</option>
        </select>
      </label>
      <button>Apply case filters</button>{" "}
      <a href={customerCaseLink({ bookingId })} onClick={onNavigate}>
        Clear status and category
      </a>
    </form>
  );
}
