import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { AppError } from "./errors.ts";
export async function migrationManifest(directory = "migrations") {
  const files = (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(`${directory}/${name}`, "utf8");
      return {
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}
export function validateAppliedMigrations(
  expected: { name: string; checksum: string }[],
  applied: { name: string; checksum: string | null }[],
) {
  const byName = new Map(applied.map((m) => [m.name, m.checksum]));
  for (const migration of expected)
    if (byName.get(migration.name) !== migration.checksum)
      throw new AppError(
        "MIGRATIONS_REQUIRED",
        "Required database migrations are missing or do not match this application artifact.",
        503,
      );
}
export async function assertSchemaReady(
  database: { query: (sql: string) => Promise<{ rows: any[] }> },
  expected?: { name: string; checksum: string }[],
) {
  const applied = await database.query(
    "SELECT name,checksum FROM public.schema_migrations",
  );
  validateAppliedMigrations(
    expected ?? (await migrationManifest()),
    applied.rows,
  );
}
