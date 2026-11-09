import type { Transaction } from "../../../shared/database.ts";
import type {
  TicketOccurrences,
  TicketOccurrence,
} from "../contracts/index.ts";
export class PostgresTicketOccurrences implements TicketOccurrences {
  async read(tx: Transaction, ids: string[]): Promise<TicketOccurrence[]> {
    const rows = (
      await tx.query(
        "SELECT id,venue_name,time_zone,starts_at,ends_at,state,version,venue_snapshot FROM inventory.occurrences WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE",
        [ids],
      )
    ).rows;
    return rows.map((r) => ({
      id: r.id,
      venueName: r.venue_name,
      venueAddress:
        typeof r.venue_snapshot?.address === "string" &&
        r.venue_snapshot.address.trim()
          ? r.venue_snapshot.address.trim()
          : null,
      venueCity:
        typeof r.venue_snapshot?.city === "string" &&
        r.venue_snapshot.city.trim()
          ? r.venue_snapshot.city.trim()
          : null,
      timeZone: r.time_zone,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
      state: r.state,
      version: r.version,
      resources: (r.venue_snapshot?.configuration?.resources ?? []).map(
        (s: any) => ({ id: s.id, label: s.label, gate: s.gate }),
      ),
    }));
  }
}
