export type Principal = { id: string; contact: string; mfaVerified: boolean };
export interface Access {
  authenticate(token: string | undefined): Promise<Principal>;
  require(
    principal: Principal,
    permission: string,
    scope?: string,
  ): Promise<void>;
}

export interface ActiveAccount {
  requireActive(
    tx: import("../../../shared/database.ts").Transaction,
    actor: string,
  ): Promise<void>;
}

export interface StaffAuthorization {
  requirePermission(
    tx: import("../../../shared/database.ts").Transaction,
    actor: string,
    permission: string,
  ): Promise<void>;
}
