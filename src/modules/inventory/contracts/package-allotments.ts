import type { Transaction } from "../../../shared/database.ts";
export type PackageAllotment = {
  departure: string;
  definitionVersion: number;
  version: number;
  capacity: number;
  components: { id: string; capacity: number }[];
};
export interface PackageAllotments {
  list(tx: Transaction, id: string): Promise<PackageAllotment[]>;
  save(
    tx: Transaction,
    id: string,
    input: Omit<PackageAllotment, "version">,
    expected: number,
  ): Promise<void>;
}
