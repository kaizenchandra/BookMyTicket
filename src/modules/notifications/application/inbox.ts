import type { Transaction } from "../../../shared/database.ts";
import type {
  DurableConsumer,
  DurableRecord,
} from "../../reporting/contracts/index.ts";
import { notificationTemplate, notificationTypes } from "../domain/template.ts";
export interface NotificationStore {
  deliver(
    tx: Transaction,
    event: DurableRecord,
    content: { title: string; body: string },
  ): Promise<void>;
  list(owner: string, after?: string, unread?: boolean): Promise<unknown>;
  read(owner: string, id: string): Promise<unknown>;
  unread(owner: string, id: string): Promise<unknown>;
  readMany(owner: string, ids: string[]): Promise<unknown>;
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
  list(owner: string, after?: string, unread = false) {
    return this.store.list(owner, after, unread);
  }
  unread(owner: string, id: string) {
    return this.store.unread(owner, id);
  }
  readMany(owner: string, ids: string[]) {
    return this.store.readMany(owner, ids);
  }
  read(owner: string, id: string) {
    return this.store.read(owner, id);
  }
}
