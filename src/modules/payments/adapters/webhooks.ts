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
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.event !== "string" ||
    !payload.payload ||
    typeof payload.payload !== "object"
  )
    throw new AppError("INVALID_PAYLOAD", "Missing webhook event.", 400);
  if (eventId !== undefined && !/^[A-Za-z0-9_-]{1,200}$/.test(eventId))
    throw new AppError(
      "INVALID_EVENT_ID",
      "Invalid webhook event identifier.",
      400,
    );
  const id =
    eventId || `sha256:${createHash("sha256").update(body).digest("hex")}`;
  const inserted = await pool.query(
    "INSERT INTO payments.webhook_events(provider_event_id,body) VALUES($1,$2) ON CONFLICT(provider_event_id) DO UPDATE SET body=payments.webhook_events.body WHERE payments.webhook_events.body=EXCLUDED.body RETURNING provider_event_id",
    [id, payload],
  );
  if (inserted.rowCount !== 1)
    throw new AppError(
      "WEBHOOK_CONFLICT",
      "Webhook identifier was reused with different content.",
      409,
    );
  return { received: true };
}
