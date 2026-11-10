import type {
  DashboardSource,
  DashboardPeriod,
} from "../../../shared/dashboard.ts";
import type { Transaction } from "../../../shared/database.ts";
export class InventoryDashboard implements DashboardSource {
  async read(tx: Transaction, period: DashboardPeriod) {
    const result = await tx.query(
      `WITH held AS (
      SELECT i.occurrence_id,i.resource_id,sum(i.quantity) AS quantity
      FROM inventory.reservation_items i JOIN inventory.reservations h ON h.id=i.reservation_id
      WHERE h.state='active' AND h.expires_at>transaction_timestamp() GROUP BY 1,2)
      SELECT count(DISTINCT o.id)::text AS occurrences,coalesce(sum(r.capacity),0)::text AS capacity,
      coalesce(sum(r.sold),0)::text AS sold,coalesce(sum(h.quantity),0)::text AS held,
      coalesce(sum(r.capacity-r.sold-coalesce(h.quantity,0)),0)::text AS unallocated
      FROM inventory.occurrences o JOIN inventory.resources r ON r.occurrence_id=o.id
      LEFT JOIN held h ON h.occurrence_id=r.occurrence_id AND h.resource_id=r.id
      WHERE o.starts_at >= $1 AND o.starts_at < $2 AND ($3::uuid[] IS NULL OR o.listing_id=ANY($3))`,
      [period.from, period.until, period.listingIds ?? null],
    );
    return result.rows[0];
  }
}
