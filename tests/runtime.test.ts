import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { secretValue, databaseConfig } from "../src/shared/config.ts";
import { validateAppliedMigrations } from "../src/shared/schema-state.ts";
test("File secrets reject ambiguous configuration and treat empty provider files as unavailable", () => {
  const dir = mkdtempSync(join(tmpdir(), "bmt-config-"));
  try {
    const file = join(dir, "secret");
    writeFileSync(file, "fixture-secret\n");
    assert.equal(secretValue("TEST", { TEST_FILE: file }), "fixture-secret");
    assert.throws(() =>
      secretValue("TEST", { TEST: "fixture", TEST_FILE: file }),
    );
    writeFileSync(file, "");
    assert.equal(secretValue("TEST", { TEST_FILE: file }), undefined);
    assert.throws(() =>
      databaseConfig({
        DATABASE_URL: "postgres://fixture",
        PGPASSWORD_FILE: file,
      }),
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("Readiness rejects missing or altered migrations and permits additive rolling upgrades", () => {
  const expected = [{ name: "001.sql", checksum: "abc" }];
  for (const applied of [
    [],
    [{ name: "001.sql", checksum: null }],
    [{ name: "001.sql", checksum: "changed" }],
  ])
    assert.throws(() => validateAppliedMigrations(expected, applied), {
      code: "MIGRATIONS_REQUIRED",
    });
  validateAppliedMigrations(expected, [
    ...expected,
    { name: "002.sql", checksum: "next" },
  ]);
});
