import { readFileSync } from "node:fs";
// File-secret configuration is explicit. Never serialize this module's values into logs.
export function secretValue(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = env[name],
    path = env[`${name}_FILE`];
  if (value && path)
    throw new Error(`Configure only ${name} or ${name}_FILE, not both`);
  if (!path) return value || undefined;
  const secret = readFileSync(path, "utf8").replace(/[\r\n]+$/, "");
  return secret || undefined;
}
for (const name of [
  "OTP_PEPPER",
  "MFA_ENCRYPTION_KEY",
  "REGISTRATION_ENCRYPTION_KEY",
  "EXPORT_ENCRYPTION_KEY",
  "TICKET_ENCRYPTION_KEY",
  "RESEND_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_PREVIOUS_WEBHOOK_SECRET",
]) {
  const value = secretValue(name);
  if (value) process.env[name] = value;
}
export function databaseConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.DATABASE_URL) {
    if (env.PGPASSWORD || env.PGPASSWORD_FILE)
      throw new Error(
        "Configure DATABASE_URL or discrete PostgreSQL settings, not both",
      );
    return { connectionString: env.DATABASE_URL };
  }
  return {
    host: env.PGHOST,
    port: Number(env.PGPORT ?? 5432),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: secretValue("PGPASSWORD", env),
  };
}
export function requireDatabaseConfiguration() {
  if (
    !process.env.DATABASE_URL &&
    !(
      process.env.PGHOST &&
      process.env.PGDATABASE &&
      process.env.PGUSER &&
      (process.env.PGPASSWORD || process.env.PGPASSWORD_FILE)
    )
  )
    throw new Error(
      "Configure DATABASE_URL or PGHOST, PGDATABASE, PGUSER and PGPASSWORD[_FILE]",
    );
}
