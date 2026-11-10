import {
  paymentMilestoneKinds,
  paymentHistoryCategories,
} from "../contracts/history.ts";
import { z } from "zod";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  PaymentHistory,
  PaymentHistoryPage,
  PaymentHistorySelection,
} from "../contracts/history.ts";
const cursorSchema = z
  .object({
    booking: z.uuid(),
    category: z.enum(paymentHistoryCategories).optional(),
    attemptId: z.uuid().nullable().optional(),
    time: z.iso.datetime(),
    kind: z.enum(paymentMilestoneKinds),
    id: z.uuid(),
  })
  .strict();
export class PostgresPaymentHistory implements PaymentHistory {
  async read(
    tx: Transaction,
    booking: string,
    after?: string,
    selection: PaymentHistorySelection = {},
  ): Promise<PaymentHistoryPage> {
    const category = selection.category ?? "all",
      attemptId = selection.attemptId?.toLowerCase() ?? null;
    let cursor: z.infer<typeof cursorSchema> | undefined;
    if (after)
      try {
        cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(after, "base64url").toString()),
        );
        if (
          cursor.booking !== booking ||
          (cursor.category ?? "all") !== category ||
          (cursor.attemptId ?? null) !== attemptId
        )
          throw new Error();
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Your booking or filters changed. Return to the first payment history page.",
          422,
        );
      }
    const rows = (
      await tx.query(
        `WITH events AS (
    SELECT timeline_id AS id,'capture_recorded'::text AS kind,captured_at AS at,amount_paise,currency,NULL::uuid AS attempt_id FROM payments.captures WHERE order_id=$1
    UNION ALL SELECT id,'recovery_recorded',created_at,amount_paise,'INR',NULL::uuid FROM payments.recovery WHERE order_id=$1
    UNION ALL SELECT id,'attempt_' || state,recorded_at,amount_paise,currency,attempt_id FROM payments.attempt_observations WHERE order_id=$1
   ) SELECT id,kind,attempt_id AS "attemptId",to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "occurredAt",amount_paise AS "amountPaise",currency
   FROM events WHERE ($2::timestamptz IS NULL OR (at,kind COLLATE "C",id)<($2::timestamptz,$3::text COLLATE "C",$4::uuid))
   AND ($5='all' OR ($5='captures' AND kind='capture_recorded') OR ($5='recovery' AND kind='recovery_recorded') OR ($5='attempts' AND attempt_id IS NOT NULL))
   AND ($6::uuid IS NULL OR attempt_id=$6)
   ORDER BY at DESC,kind COLLATE "C" DESC,id DESC LIMIT 21`,
        [
          booking,
          cursor?.time ?? null,
          cursor?.kind ?? null,
          cursor?.id ?? null,
          category,
          attemptId,
        ],
      )
    ).rows;
    const items = rows.slice(0, 20),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > 20
          ? Buffer.from(
              JSON.stringify({
                booking,
                category,
                attemptId,
                time: last.occurredAt,
                kind: last.kind,
                id: last.id,
              }),
            ).toString("base64url")
          : null,
    };
  }
}
