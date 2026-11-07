import { PaymentReconciliation } from "./modules/payments/adapters/reconciliation.ts";
import { setTimeout } from "node:timers/promises";
import { writeFile, rename } from "node:fs/promises";
import { commerce, notificationService } from "./composition.ts";
import { WebhookWorker } from "./modules/payments/adapters/worker.ts";
import { ReservationExpiry } from "./modules/inventory/application/expiry.ts";
import { PostgresReservationExpiry } from "./modules/inventory/adapters/expiry.ts";
import { pool } from "./shared/database.ts";
import { requireDatabaseConfiguration } from "./shared/config.ts";
import { assertSchemaReady } from "./shared/schema-state.ts";
requireDatabaseConfiguration();
const { collection, attendeeExports } = commerce();
const notifications = notificationService();
const reconciliation = new PaymentReconciliation(collection);
const worker = new WebhookWorker(collection),
  expiry = new ReservationExpiry(new PostgresReservationExpiry());
const heartbeat =
  process.env.WORKER_HEARTBEAT_FILE ??
  "/tmp/bookmyticket-worker-heartbeat.json";
const stop = new AbortController();
let running = true;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    running = false;
    stop.abort();
  });
try {
  await assertSchemaReady(pool);
  while (running) {
    let delay = 1000;
    try {
      const processed = await worker.once(),
        reconciled = await reconciliation.once(),
        expired = await expiry.sweep(),
        exported = await attendeeExports.once(),
        notified = await notifications.once();
      await writeFile(
        `${heartbeat}.tmp`,
        JSON.stringify({
          updatedAt: new Date().toISOString(),
          pid: process.pid,
        }),
        { mode: 0o600 },
      );
      await rename(`${heartbeat}.tmp`, heartbeat);
      if (processed || reconciled || exported || notified || expired === 100)
        delay = 50;
    } catch {
      console.error(
        JSON.stringify({
          event: "worker_iteration_failed",
          retryAfterMs: 5000,
        }),
      );
      delay = 5000;
    }
    try {
      await setTimeout(delay, undefined, { signal: stop.signal });
    } catch {
      if (running) throw new Error("Worker delay failed");
    }
  }
} finally {
  await pool.end();
}
