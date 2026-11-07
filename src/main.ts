import { requireDatabaseConfiguration } from "./shared/config.ts";
import { buildApp } from "./app.ts";
import { pool } from "./shared/database.ts";
requireDatabaseConfiguration();
const app = await buildApp();
await app.listen({
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
