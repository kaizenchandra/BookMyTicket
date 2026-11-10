import type { DashboardSelection } from "../../../shared/dashboard.ts";
import type { Transaction } from "../../../shared/database.ts";
export class CatalogDashboard {
  async match(tx: Transaction, filters: DashboardSelection) {
    if (!filters.product && !filters.city && !filters.supplier) return null;
    return (
      await tx.query(
        `SELECT id FROM catalog.listings WHERE ($1::text IS NULL OR kind=$1) AND ($2::text IS NULL OR lower(city)=lower($2)) AND ($3::uuid IS NULL OR organization_id=$3) ORDER BY id`,
        [
          filters.product ?? null,
          filters.city ?? null,
          filters.supplier ?? null,
        ],
      )
    ).rows.map((r) => r.id as string);
  }
  async classify(tx: Transaction, ids: string[]) {
    const result = await tx.query(
      "SELECT id,kind FROM catalog.listings WHERE id=ANY($1::uuid[])",
      [ids],
    );
    return Object.fromEntries(result.rows.map((r) => [r.id, r.kind])) as Record<
      string,
      string
    >;
  }
}
