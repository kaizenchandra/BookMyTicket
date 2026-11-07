import { readFileSync } from "node:fs";
try {
  const state = JSON.parse(
    readFileSync(
      process.env.WORKER_HEARTBEAT_FILE ??
        "/tmp/bookmyticket-worker-heartbeat.json",
      "utf8",
    ),
  );
  const age = Date.now() - Date.parse(state.updatedAt);
  if (!Number.isFinite(age) || age < 0 || age > 30000) process.exit(1);
} catch {
  process.exit(1);
}
