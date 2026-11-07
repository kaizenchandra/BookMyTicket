import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export type ExportInput = {
  occurrenceId: string;
  formId: string;
  fields: string[];
  purpose: string;
  confirmScope: boolean;
};
export interface ExportSources {
  authorize(tx: Transaction, actor: string, occurrence: string): Promise<void>;
  fields(
    tx: Transaction,
    occurrence: string,
    form: string,
  ): Promise<{ id: string; label: string }[]>;
  rows(
    tx: Transaction,
    occurrence: string,
    form: string,
  ): Promise<
    { orderId: string; answers: Record<string, string | boolean>[] }[]
  >;
}
export interface ExportStore {
  request(actor: string, key: string, input: ExportInput): Promise<unknown>;
  list(actor: string, occurrence: string): Promise<unknown>;
  download(actor: string, id: string): Promise<string>;
  once(): Promise<boolean>;
}
export class AttendeeExports {
  constructor(private store: ExportStore) {}
  async request(actor: string, key: string, input: ExportInput) {
    if (
      !input.confirmScope ||
      !input.fields.length ||
      input.fields.length > 20 ||
      new Set(input.fields).size !== input.fields.length ||
      input.purpose.trim().length < 10 ||
      input.purpose.length > 500 ||
      key.length < 8 ||
      key.length > 100
    )
      throw new AppError(
        "INVALID_EXPORT",
        "Confirm the scope, select unique fields and describe the export purpose.",
        422,
      );
    return this.store.request(actor, key, {
      ...input,
      fields: [...input.fields].sort(),
      purpose: input.purpose.trim(),
    });
  }
  list(actor: string, occurrence: string) {
    return this.store.list(actor, occurrence);
  }
  download(actor: string, id: string) {
    return this.store.download(actor, id);
  }
  once() {
    return this.store.once();
  }
}
