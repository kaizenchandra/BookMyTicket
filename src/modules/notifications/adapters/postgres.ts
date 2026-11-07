import { randomUUID } from "node:crypto";
import { pool, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { DurableRecord } from "../../reporting/contracts/index.ts";
import type { NotificationStore } from "../application/inbox.ts";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class PostgresNotifications implements NotificationStore {
  async deliver(
    tx: Transaction,
    event: DurableRecord,
    content: { title: string; body: string },
  ) {
    if (
      event.payload.version !== 1 ||
      typeof event.payload.ownerId !== "string" ||
      !uuid.test(event.payload.ownerId) ||
      !uuid.test(event.aggregate_id)
    )
      throw new AppError(
        "INVALID_EVENT",
        "Notification event is invalid.",
        422,
      );
    await tx.query(
      "INSERT INTO notifications.messages(id,owner_id,event_id,template,template_version,title,body,href,occurred_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8) ON CONFLICT(event_id) DO NOTHING",
      [
        randomUUID(),
        event.payload.ownerId,
        event.id,
        event.type,
        content.title,
        content.body,
        `/bookings/${event.aggregate_id}`,
        event.created_at,
      ],
    );
  }
  async list(owner: string, after?: string, unread = false) {
    let cursor: { created_at: Date; id: string } | undefined;
    if (after) {
      cursor = (
        await pool.query(
          "SELECT id,created_at FROM notifications.messages WHERE id=$1 AND owner_id=$2",
          [after, owner],
        )
      ).rows[0];
      if (!cursor)
        throw new AppError(
          "INVALID_CURSOR",
          "Notification cursor is unavailable.",
          422,
        );
    }
    const result = await pool.query(
      "SELECT id,title,body,href,occurred_at,created_at,read_at FROM notifications.messages WHERE owner_id=$1 AND (NOT $2::boolean OR read_at IS NULL) AND ($3::timestamptz IS NULL OR (created_at,id)<($3,$4::uuid)) ORDER BY created_at DESC,id DESC LIMIT 21",
      [owner, unread, cursor?.created_at ?? null, cursor?.id ?? null],
    );
    return {
      items: result.rows.slice(0, 20),
      nextCursor: result.rows.length > 20 ? result.rows[19].id : null,
      serverTime: new Date().toISOString(),
    };
  }
  async read(owner: string, id: string) {
    const result = await pool.query(
      "UPDATE notifications.messages SET read_at=coalesce(read_at,clock_timestamp()) WHERE owner_id=$1 AND id=$2 RETURNING id,read_at",
      [owner, id],
    );
    if (!result.rowCount)
      throw new AppError("NOT_FOUND", "Notification not found.", 404);
    return result.rows[0];
  }
}
