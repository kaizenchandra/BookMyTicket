import type {
  DashboardSource,
  DashboardSelection,
  DashboardCatalog,
  DashboardBookings,
} from "../../../shared/dashboard.ts";
import type { Transaction } from "../../../shared/database.ts";
export function dashboardPeriod(
  year: number,
  group: "month" | "quarter" | "year",
  index: number,
) {
  const month =
    group === "year" ? 0 : group === "quarter" ? (index - 1) * 3 : index - 1;
  const length = group === "year" ? 12 : group === "quarter" ? 3 : 1;
  const boundary = (m: number) =>
    new Date(Date.UTC(year, m, 1) - 330 * 60_000).toISOString();
  return { from: boundary(month), until: boundary(month + length) };
}
export type DashboardRange = DashboardSelection & {
  range?: "today" | "yesterday" | "7days" | "30days" | "custom";
  from?: string;
  until?: string;
};
export function dashboardRange(now: Date, selection: DashboardRange) {
  const day = 86400000,
    offset = 330 * 60000;
  if (selection.range === "custom")
    return {
      from: new Date(`${selection.from}T00:00:00+05:30`).toISOString(),
      until: new Date(`${selection.until}T00:00:00+05:30`).toISOString(),
    };
  const today = Math.floor((now.getTime() + offset) / day) * day - offset;
  const until = selection.range === "yesterday" ? today : today + day;
  const count =
    selection.range === "7days" ? 7 : selection.range === "30days" ? 30 : 1;
  return {
    from: new Date(until - count * day).toISOString(),
    until: new Date(until).toISOString(),
  };
}
export class Dashboard {
  constructor(
    private bookings: DashboardBookings,
    private payments: DashboardSource,
    private inventory: DashboardSource,
    private catalog: DashboardCatalog,
    private support?: DashboardSource,
  ) {}
  async read(
    tx: Transaction,
    year: number,
    group: "month" | "quarter" | "year",
    index: number,
    selection: DashboardRange = {},
    now: Date = new Date(),
  ) {
    const bounds = selection.range
      ? dashboardRange(now, selection)
      : dashboardPeriod(year, group, index);
    const listingIds = (await this.catalog.match(tx, selection)) ?? null;
    const bookingIds =
      (await this.bookings.matching(tx, listingIds, selection.state)) ?? null;
    const grain =
      Date.parse(bounds.until) - Date.parse(bounds.from) <= 62 * 86400000
        ? ("day" as const)
        : ("month" as const);
    const period = {
      ...bounds,
      listingIds,
      bookingIds,
      state: selection.state,
      grain,
    };
    const bookings = await this.bookings.read(tx, period);
    const payments = await this.payments.read(tx, period);
    const inventory = await this.inventory.read(tx, period);
    const lines = bookings.lines as {
      listing_id: string | null;
      gbv: string;
      bookings: string;
      confirmed: string;
    }[];
    const ids = lines
      .map((l) => l.listing_id)
      .filter(
        (id): id is string => !!id && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id),
      );
    const kinds = await this.catalog.classify(tx, ids);
    const counts: Record<string, bigint> = {},
      confirmedCounts: Record<string, bigint> = {};
    const totals: Record<string, bigint> = {
      movie: 0n,
      event: 0n,
      sports: 0n,
      "mixed / unmapped": 0n,
    };
    for (const line of lines) {
      const kind =
        (line.listing_id && kinds[line.listing_id]) || "mixed / unmapped";
      totals[kind] = (totals[kind] ?? 0n) + BigInt(line.gbv);
      counts[kind] = (counts[kind] ?? 0n) + BigInt(line.bookings);
      confirmedCounts[kind] =
        (confirmedCounts[kind] ?? 0n) + BigInt(line.confirmed);
    }
    const { lines: _, timeseries: _series, ...bookingSummary } = bookings;
    const raw = bookings.timeseries as {
      bucket: string;
      bookings: string;
      gbv: string;
    }[];
    const timeseries = [];
    let cursor = Date.parse(bounds.from) + 330 * 60000;
    const end = Date.parse(bounds.until) + 330 * 60000;
    while (cursor < end) {
      const key = new Date(cursor)
        .toISOString()
        .slice(0, grain === "day" ? 10 : 7);
      timeseries.push(
        raw.find((r) => r.bucket === key) ?? {
          bucket: key,
          bookings: "0",
          gbv: "0",
        },
      );
      const d = new Date(cursor);
      cursor =
        grain === "day"
          ? cursor + 86400000
          : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }
    return {
      support: this.support ? await this.support.read(tx, period) : null,
      filters: {
        product: selection.product ?? null,
        city: selection.city ?? null,
        supplier: selection.supplier ?? null,
        state: selection.state ?? null,
        currency: "INR",
      },
      timeseries,
      grain,
      verticals: Object.entries(totals).map(([kind, gbv]) => ({
        kind,
        gbv: gbv.toString(),
        bookings: (counts[kind] ?? 0n).toString(),
        confirmed: (confirmedCounts[kind] ?? 0n).toString(),
      })),
      period: { ...bounds, year, group, index, timeZone: "Asia/Kolkata" },
      bookings: bookingSummary,
      payments,
      inventory,
      includesDemo: true,
      currency: "INR",
    };
  }
}
