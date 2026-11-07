import { createHash, randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { PublishedCatalog } from "../../catalog/contracts/index.ts";
import type { Component } from "../domain/reservation.ts";
import type { ReservationPort } from "../application/reservations.ts";
export class PostgresReservations implements ReservationPort {
  constructor(private catalog: PublishedCatalog) {}
  async reserve(ownerId: string, key: string, items: Component[]) {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(items))
      .digest("hex");
    return transaction(async (tx) => {
      // Serialize all hold operations for one account, including purchase-limit checks.
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        ownerId,
      ]);
      const existing = await tx.query(
        "SELECT * FROM inventory.reservations WHERE owner_id=$1 AND idempotency_key=$2",
        [ownerId, key],
      );
      if (existing.rowCount) {
        if (existing.rows[0].fingerprint !== fingerprint)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "This key was used with different selections.",
          );
        return this.read(tx, ownerId, existing.rows[0].id);
      }
      const active = await tx.query(
        "SELECT count(*)::int n FROM inventory.reservations WHERE owner_id=$1 AND state='active' AND expires_at>clock_timestamp()",
        [ownerId],
      );
      if (active.rows[0].n >= 3)
        throw new AppError(
          "HOLD_LIMIT",
          "Release an active reservation before starting another.",
          429,
        );
      const occurrenceIds = [
        ...new Set(items.map((i) => i.occurrenceId)),
      ].sort();
      const occurrences = await tx.query(
        "SELECT * FROM inventory.occurrences WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [occurrenceIds],
      );
      if (occurrences.rowCount !== occurrenceIds.length)
        throw new AppError("NOT_FOUND", "Occurrence not found.", 404);
      // Multiple occurrences are allowed only through future validated package definitions.
      if (occurrenceIds.length !== 1)
        throw new AppError(
          "UNSUPPORTED_CART",
          "Select one occurrence per reservation.",
          422,
        );
      for (const occurrence of occurrences.rows)
        await this.catalog.requirePublished(occurrence.listing_id, tx);
      const now = (await tx.query("SELECT clock_timestamp() now")).rows[0]
        .now as Date;
      if (
        occurrences.rows.some(
          (o) =>
            o.state !== "open" || o.sales_open > now || o.sales_close <= now,
        )
      )
        throw new AppError(
          "SALES_CLOSED",
          "Sales are not open for this occurrence.",
        );
      const reserved = [];
      for (const item of items) {
        const result = await tx.query(
          "SELECT * FROM inventory.resources WHERE occurrence_id=$1 AND id=$2 FOR UPDATE",
          [item.occurrenceId, item.resourceId],
        );
        if (!result.rowCount)
          throw new AppError(
            "NOT_FOUND",
            "Inventory selection not found.",
            404,
          );
        const resource = result.rows[0];
        const held = await tx.query(
          "SELECT coalesce(sum(i.quantity),0)::int n FROM inventory.reservation_items i JOIN inventory.reservations r ON r.id=i.reservation_id WHERE i.occurrence_id=$1 AND i.resource_id=$2 AND r.state='active' AND r.expires_at>clock_timestamp()",
          [item.occurrenceId, item.resourceId],
        );
        if (resource.sold + held.rows[0].n + item.quantity > resource.capacity)
          throw new AppError(
            "INVENTORY_CONFLICT",
            `${resource.label} is no longer available. Choose again.`,
          );
        reserved.push({
          ...item,
          price: resource.price_paise,
          kind: resource.kind,
        });
      }
      const id = randomUUID();
      await tx.query(
        "INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1,$2,$3,$4,'active',clock_timestamp()+interval '300 seconds')",
        [id, ownerId, key, fingerprint],
      );
      for (const i of reserved) {
        await tx.query(
          "INSERT INTO inventory.reservation_items VALUES($1,$2,$3,$4,$5)",
          [id, i.occurrenceId, i.resourceId, i.quantity, i.price],
        );
        if (i.kind === "seat")
          await tx.query(
            "INSERT INTO inventory.seat_ownership(occurrence_id,resource_id,reservation_id) VALUES($1,$2,$3) ON CONFLICT(occurrence_id,resource_id) DO UPDATE SET reservation_id=$3,version=inventory.seat_ownership.version+1",
            [i.occurrenceId, i.resourceId, id],
          );
      }
      return this.read(tx, ownerId, id);
    });
  }
  async read(tx: Transaction, ownerId: string, id: string) {
    const r = await tx.query(
      "SELECT id,state,expires_at,version,clock_timestamp() server_time, CASE WHEN state='active' AND expires_at<=clock_timestamp() THEN 'expired' ELSE state END effective_state FROM inventory.reservations WHERE id=$1 AND owner_id=$2",
      [id, ownerId],
    );
    if (!r.rowCount)
      throw new AppError("NOT_FOUND", "Reservation not found.", 404);
    const items = (
      await tx.query(
        "SELECT occurrence_id,resource_id,quantity,unit_price_paise FROM inventory.reservation_items WHERE reservation_id=$1 ORDER BY occurrence_id,resource_id",
        [id],
      )
    ).rows;
    return {
      ...r.rows[0],
      items,
      currency: "INR",
      subtotalPaise: items.reduce(
        (n, i) => n + i.quantity * i.unit_price_paise,
        0,
      ),
    };
  }
  async get(ownerId: string, id: string) {
    return transaction((tx) => this.read(tx, ownerId, id));
  }
  async release(ownerId: string, id: string) {
    return transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        ownerId,
      ]);
      const r = await tx.query(
        "SELECT * FROM inventory.reservations WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [id, ownerId],
      );
      if (!r.rowCount)
        throw new AppError("NOT_FOUND", "Reservation not found.", 404);
      if (r.rows[0].state === "consumed")
        throw new AppError(
          "ALREADY_CONSUMED",
          "A confirmed booking cannot be released as a hold.",
        );
      await tx.query(
        "UPDATE inventory.reservations SET state='released',version=version+1 WHERE id=$1 AND state='active'",
        [id],
      );
      await tx.query(
        "UPDATE inventory.seat_ownership SET reservation_id=NULL,version=version+1 WHERE reservation_id=$1",
        [id],
      );
      return this.read(tx, ownerId, id);
    });
  }
  async expire(id: string, version: number) {
    return transaction(async (tx) => {
      const r = await tx.query(
        "UPDATE inventory.reservations SET state='expired',version=version+1 WHERE id=$1 AND version=$2 AND state='active' AND expires_at<=clock_timestamp() RETURNING id",
        [id, version],
      );
      if (r.rowCount)
        await tx.query(
          "UPDATE inventory.seat_ownership SET reservation_id=NULL,version=version+1 WHERE reservation_id=$1",
          [id],
        );
      return r.rowCount === 1;
    });
  }
  async availability(id: string) {
    const occurrence = (
      await pool.query("SELECT * FROM inventory.occurrences WHERE id=$1", [id])
    ).rows[0];
    if (!occurrence)
      throw new AppError("NOT_FOUND", "Occurrence not found.", 404);
    await this.catalog.requirePublished(occurrence.listing_id);
    const resources = (
      await pool.query(
        "SELECT s.id,s.label,s.kind,s.capacity,s.sold,s.price_paise,s.version,s.capacity-s.sold-coalesce((SELECT sum(i.quantity) FROM inventory.reservation_items i JOIN inventory.reservations r ON r.id=i.reservation_id WHERE i.occurrence_id=s.occurrence_id AND i.resource_id=s.id AND r.state='active' AND r.expires_at>clock_timestamp()),0)::int available FROM inventory.resources s WHERE occurrence_id=$1 ORDER BY id",
        [id],
      )
    ).rows;
    return {
      occurrence,
      resources,
      serverTime: new Date().toISOString(),
      authoritativeAtReservation: true,
    };
  }
}
