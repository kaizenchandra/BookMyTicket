import type { Transaction } from "../../../shared/database.ts";
import type {
  PackageAllotments,
  PackageAllotment,
} from "../contracts/package-allotments.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresPackageAllotments implements PackageAllotments {
  async list(tx: Transaction, id: string) {
    return (
      await tx.query(
        `SELECT to_char(departure,'YYYY-MM-DD') AS departure,definition_version AS "definitionVersion",version,capacity,components FROM inventory.package_allotments WHERE package_id=$1 ORDER BY departure`,
        [id],
      )
    ).rows as PackageAllotment[];
  }
  async save(
    tx: Transaction,
    id: string,
    input: Omit<PackageAllotment, "version">,
    expected: number,
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "package-allotment:" + id + ":" + input.departure,
    ]);
    const previous = (
      await tx.query(
        "SELECT version FROM inventory.package_allotments WHERE package_id=$1 AND departure=$2 FOR UPDATE",
        [id, input.departure],
      )
    ).rows[0];
    if ((previous?.version ?? 0) !== expected)
      throw new AppError(
        "STALE_VERSION",
        "Allotment changed. Reload before saving.",
      );
    await tx.query(
      "INSERT INTO inventory.package_allotments(package_id,departure,capacity,components,definition_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT(package_id,departure) DO UPDATE SET capacity=$3,components=$4,definition_version=$5,version=inventory.package_allotments.version+1",
      [
        id,
        input.departure,
        input.capacity,
        JSON.stringify(input.components),
        input.definitionVersion,
      ],
    );
  }
}
