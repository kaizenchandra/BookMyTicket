import type { Transaction } from "../../../shared/database.ts";
export interface OrganizationAccess {
  requireExport(
    actorId: string,
    organizationId: string,
    tx: Transaction,
  ): Promise<void>;
  requireMember(
    actorId: string,
    organizationId: string,
    write?: boolean,
    tx?: Transaction,
  ): Promise<void>;
  requireApproved(organizationId: string, tx?: Transaction): Promise<void>;
}
