import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const project = process.env.COMPOSE_PROJECT_NAME ?? "bookmyticket-verify";
const start = Date.now(),
  evidence = {
    checkedAt: new Date().toISOString(),
    project,
    scope: "Local container recovery; isolated test fixtures only",
    checks: [],
  };
function docker(args, input) {
  const r = spawnSync("docker", ["compose", "-p", project, ...args], {
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw new Error(
      `Compose recovery operation failed: ${r.stderr.toString()}`,
    );
  return r.stdout;
}
function sql(database, query) {
  return docker([
    "exec",
    "-T",
    "database",
    "psql",
    "-X",
    "-A",
    "-t",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "bookmyticket",
    "-d",
    database,
    "-c",
    query,
  ])
    .toString()
    .trim();
}
const counts = `SELECT json_build_object('accounts',(SELECT count(*) FROM identity.accounts),'orders',(SELECT count(*) FROM bookings.orders),'reservations',(SELECT count(*) FROM inventory.reservations),'journals',(SELECT count(*) FROM finance.journals),'lines',(SELECT count(*) FROM finance.lines),'migrations',(SELECT count(*) FROM public.schema_migrations),'venues',(SELECT count(*) FROM venues.venues),'spaces',(SELECT count(*) FROM venues.spaces),'plans',(SELECT count(*) FROM venues.plans),'forms',(SELECT count(*) FROM events.registration_forms),'registrations',(SELECT count(*) FROM bookings.registrations),'attendeeExports',(SELECT count(*) FROM reporting.attendee_exports),'tickets',(SELECT count(*) FROM ticketing.tickets),'admissions',(SELECT count(*) FROM ticketing.admissions),'pendingCancellations',(SELECT count(*) FROM bookings.pending_cancellations))`;
const before = JSON.parse(sql("bookmyticket_test", counts));
assert(before.accounts > 0 && before.orders > 0 && before.journals > 0);
docker(["restart", "database", "app", "worker"]);
docker(["up", "-d", "--wait", "--wait-timeout", "90"]);
assert.deepEqual(JSON.parse(sql("bookmyticket_test", counts)), before);
evidence.checks.push({
  name: "database/application/worker restart retains fixture records",
  passed: true,
  counts: before,
});
const dump = docker([
  "exec",
  "-T",
  "database",
  "pg_dump",
  "-U",
  "bookmyticket",
  "-d",
  "bookmyticket_test",
  "-Fc",
]);
mkdirSync(".local/backups", { recursive: true, mode: 0o700 });
const backup = `.local/backups/fixture-${Date.now()}.dump`;
writeFileSync(backup, dump, { mode: 0o600 });
const restored = `bookmyticket_restore_${Date.now()}`;
sql("postgres", `CREATE DATABASE ${restored}`);
docker(
  [
    "exec",
    "-T",
    "database",
    "pg_restore",
    "-U",
    "bookmyticket",
    "--exit-on-error",
    "-d",
    restored,
  ],
  dump,
);
assert.deepEqual(JSON.parse(sql(restored, counts)), before);
assert.equal(
  sql(
    restored,
    "SELECT count(*) FROM (SELECT journal_id FROM finance.lines GROUP BY journal_id HAVING sum(amount_paise)<>0) q",
  ),
  "0",
);
assert.equal(
  sql(
    restored,
    "SELECT count(*) FROM inventory.seat_ownership s LEFT JOIN inventory.reservations r ON r.id=s.reservation_id WHERE s.reservation_id IS NOT NULL AND r.id IS NULL",
  ),
  "0",
);
assert(before.venues > 0 && before.spaces > 0 && before.plans > 0);
assert.equal(
  sql(
    restored,
    "SELECT count(*) FROM inventory.occurrences o JOIN venues.plans p ON p.id=o.plan_id WHERE o.venue_snapshot->>'id' IS DISTINCT FROM o.plan_id::text OR o.venue_snapshot->'configuration' IS DISTINCT FROM p.configuration",
  ),
  "0",
);
evidence.checks.push({
  name: "custom-format backup restored into separate database",
  passed: true,
  database: restored,
  bytes: dump.length,
  counts: before,
  balancedJournals: true,
  noOrphanSeatOwners: true,
  planSnapshotsMatchImmutableVersions: true,
});
evidence.elapsedMs = Date.now() - start;
evidence.limitations = [
  "No production RPO/RTO claim",
  "Ticket/registration/export fixture keys are ephemeral: restoration checks records, not historical key recovery or decryption",
  "No point-in-time recovery or traffic failover tested",
  "Application rollback across schema versions not tested",
];
writeFileSync(
  "docs/evidence/compose-recovery.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(
  "Restart persistence and isolated fixture backup/restore checks passed.",
);
