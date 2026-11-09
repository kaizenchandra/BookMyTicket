import {
  notificationCategories,
  type NotificationCategory,
} from "../domain/template.ts";
import { randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { DurableRecord } from "../../reporting/contracts/index.ts";
import type {
  NotificationDateRange,
  NotificationStore,
} from "../application/inbox.ts";
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
      !uuid.test(event.aggregate_id) ||
      (event.type === "support.case_assigned" &&
        (typeof event.payload.caseVersion !== "number" ||
          !Number.isSafeInteger(event.payload.caseVersion) ||
          event.payload.caseVersion < 1)) ||
      (event.type === "support.staff_replied" &&
        (typeof event.payload.messageId !== "string" ||
          !uuid.test(event.payload.messageId)))
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
        event.type === "support.staff_replied"
          ? `/cases?caseId=${event.aggregate_id}`
          : event.type === "support.case_assigned"
            ? `/operations?caseId=${event.aggregate_id}`
            : `/bookings/${event.aggregate_id}`,
        event.created_at,
      ],
    );
  }
  async list(
    owner: string,
    after?: string,
    unread = false,
    category?: NotificationCategory,
    readOnly = false,
    dates: NotificationDateRange = {},
  ) {
    let cursor: { created_at: string; id: string } | undefined;
    if (after) {
      cursor = (
        await pool.query(
          `SELECT id,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
           FROM notifications.messages WHERE id=$1 AND owner_id=$2`,
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
      "SELECT id,title,body,href,occurred_at,created_at,read_at FROM notifications.messages WHERE owner_id=$1 AND (NOT $2::boolean OR read_at IS NULL) AND (NOT $6::boolean OR read_at IS NOT NULL) AND ($5::text[] IS NULL OR template=ANY($5)) AND ($7::date IS NULL OR occurred_at >= ($7::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($8::date IS NULL OR occurred_at < (($8::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($3::timestamptz IS NULL OR (created_at,id)<($3,$4::uuid)) ORDER BY created_at DESC,id DESC LIMIT 21",
      [
        owner,
        unread,
        cursor?.created_at ?? null,
        cursor?.id ?? null,
        category ? notificationCategories[category] : null,
        readOnly,
        dates.fromDate ?? null,
        dates.toDate ?? null,
      ],
    );
    const count = await pool.query(
      "SELECT count(*)::int AS count FROM notifications.messages WHERE owner_id=$1 AND read_at IS NULL",
      [owner],
    );
    return {
      unreadCount: count.rows[0].count,
      items: result.rows.slice(0, 20),
      nextCursor: result.rows.length > 20 ? result.rows[19].id : null,
      serverTime: new Date().toISOString(),
    };
  }
  async unread(owner: string, id: string) {
    const result = await pool.query(
      "UPDATE notifications.messages SET read_at=NULL WHERE owner_id=$1 AND id=$2 RETURNING id,read_at",
      [owner, id],
    );
    if (!result.rowCount)
      throw new AppError("NOT_FOUND", "Notification not found.", 404);
    return result.rows[0];
  }
  readMany(owner: string, ids: string[]) {
    return this.setReadMany(owner, ids, true);
  }
  unreadMany(owner: string, ids: string[]) {
    return this.setReadMany(owner, ids, false);
  }
  private async setReadMany(owner: string, ids: string[], read: boolean) {
    return transaction(async (tx) => {
      const rows = await tx.query(
        "SELECT id FROM notifications.messages WHERE owner_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",
        [owner, ids],
      );
      if (rows.rowCount !== ids.length)
        throw new AppError(
          "NOT_FOUND",
          "One or more notifications are unavailable. Refresh the inbox.",
          404,
        );
      await tx.query(
        read
          ? "UPDATE notifications.messages SET read_at=coalesce(read_at,statement_timestamp()) WHERE owner_id=$1 AND id=ANY($2::uuid[])"
          : "UPDATE notifications.messages SET read_at=NULL WHERE owner_id=$1 AND id=ANY($2::uuid[])",
        [owner, ids],
      );
      return { ids: rows.rows.map((r) => r.id), read };
    });
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
