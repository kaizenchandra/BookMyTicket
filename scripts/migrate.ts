import { pool, transaction } from "../src/shared/database.ts";
import { migrationManifest } from "../src/shared/schema-state.ts";
export async function migrate() {
  const migrations = await migrationManifest();
  await transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(73312011)");
    await tx.query(
      "CREATE TABLE IF NOT EXISTS public.schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(),checksum text)",
    );
    await tx.query(
      "ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS checksum text",
    );
    for (const migration of migrations) {
      const applied = (
        await tx.query(
          "SELECT checksum FROM public.schema_migrations WHERE name=$1",
          [migration.name],
        )
      ).rows[0];
      if (applied) {
        if (applied.checksum && applied.checksum !== migration.checksum)
          throw new Error(
            `Applied migration checksum mismatch: ${migration.name}`,
          );
        // One-time baseline for databases created by versions before checksum recording.
        if (!applied.checksum)
          await tx.query(
            "UPDATE public.schema_migrations SET checksum=$2 WHERE name=$1",
            [migration.name, migration.checksum],
          );
        continue;
      }
      await tx.query(migration.sql);
      await tx.query(
        "INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)",
        [migration.name, migration.checksum],
      );
    }
  });
}
if (process.argv[1]?.endsWith("migrate.ts")) {
  try {
    await migrate();
  } finally {
    await pool.end();
  }
}
