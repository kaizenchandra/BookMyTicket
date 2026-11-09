import type { Transaction } from "../../../shared/database.ts";
import type {
  DurableConsumer,
  DurableRecord,
} from "../../reporting/contracts/index.ts";
import {
  type NotificationCategory,
  notificationTemplate,
  notificationTypes,
} from "../domain/template.ts";
export type NotificationDateRange = { fromDate?: string; toDate?: string };
export interface NotificationStore {
  deliver(
    tx: Transaction,
    event: DurableRecord,
    content: { title: string; body: string },
  ): Promise<void>;
  list(
    owner: string,
    after?: string,
    unread?: boolean,
    category?: NotificationCategory,
    readOnly?: boolean,
    dates?: NotificationDateRange,
  ): Promise<unknown>;
  read(owner: string, id: string): Promise<unknown>;
  unread(owner: string, id: string): Promise<unknown>;
  readMany(owner: string, ids: string[]): Promise<unknown>;
  unreadMany(owner: string, ids: string[]): Promise<unknown>;
}
export class Notifications {
  constructor(
    private store: NotificationStore,
    private consumer: DurableConsumer,
  ) {}
  once() {
    return this.consumer.once(
      "customer-inbox-v1",
      notificationTypes,
      (tx, event) =>
        this.store.deliver(tx, event, notificationTemplate(event.type)),
    );
  }
  list(
    owner: string,
    after?: string,
    unread = false,
    category?: NotificationCategory,
    readOnly = false,
    dates: NotificationDateRange = {},
  ) {
    return this.store.list(owner, after, unread, category, readOnly, dates);
  }
  unread(owner: string, id: string) {
    return this.store.unread(owner, id);
  }
  unreadMany(owner: string, ids: string[]) {
    return this.store.unreadMany(owner, ids);
  }
  readMany(owner: string, ids: string[]) {
    return this.store.readMany(owner, ids);
  }
  read(owner: string, id: string) {
    return this.store.read(owner, id);
  }
}
