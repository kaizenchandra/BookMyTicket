import type { Transaction } from "../../../shared/database.ts";
export interface RegistrationReport {
  confirmed(
    tx: Transaction,
    occurrence: string,
    form: string,
  ): Promise<
    { orderId: string; answers: Record<string, string | boolean>[] }[]
  >;
}
