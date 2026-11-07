import pg from "pg";
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_ADMIN_URL ??
    "postgresql://bookmyticket:local-only-change-me@127.0.0.1:55432/postgres",
});
await client.connect();
if (
  !(
    await client.query(
      "SELECT 1 FROM pg_database WHERE datname='bookmyticket_test'",
    )
  ).rowCount
)
  await client.query("CREATE DATABASE bookmyticket_test");
await client.end();
