import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const db = new EmbeddedPostgres({
  databaseDir: ".local/postgres",
  user: "bookmyticket",
  password: "local-only-change-me",
  port: 55432,
  persistent: true,
  autoRehydrateSymlinks: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(".local/postgres/PG_VERSION")) await db.initialise();
await db.start();
const client = db.getPgClient();
await client.connect();
if (
  !(
    await client.query(
      "SELECT 1 FROM pg_database WHERE datname='bookmyticket_dev'",
    )
  ).rowCount
)
  await db.createDatabase("bookmyticket_dev");
await client.end();
console.log(
  "Local PostgreSQL ready on 127.0.0.1:55432; development database created. No catalog fixtures loaded.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await db.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
