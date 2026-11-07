import { createHash } from "node:crypto";
import { pool } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import { verifyHmac } from "./razorpay.ts";
export async function ingestWebhook(
  body: Buffer,
  signature: string,
  eventId?: string,
) {
  const secrets = [
    process.env.RAZORPAY_WEBHOOK_SECRET,
    process.env.RAZORPAY_PREVIOUS_WEBHOOK_SECRET,
  ].filter(Boolean) as string[];
  if (!secrets.length)
    throw new AppError(
      "WEBHOOK_UNAVAILABLE",
      "Webhook verification is not configured.",
      503,
    );
  if (!secrets.some((s) => verifyHmac(body, signature, s)))
    throw new AppError(
      "INVALID_SIGNATURE",
      "Webhook signature validation failed.",
      401,
    );
  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    throw new AppError("INVALID_PAYLOAD", "Malformed webhook.", 400);
  }
  if (typeof payload.event !== "string" || !payload.payload)
    throw new AppError("INVALID_PAYLOAD", "Missing webhook event.", 400);
  const id =
    eventId || `sha256:${createHash("sha256").update(body).digest("hex")}`;
  await pool.query(
    "INSERT INTO payments.webhook_events(provider_event_id,body) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [id, payload],
  );
  return { received: true };
}
