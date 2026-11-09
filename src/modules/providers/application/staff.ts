import { AppError } from "../../../shared/errors.ts";
import type { Access, Principal } from "../../identity/contracts/index.ts";
export type StaffRole = "editor" | "viewer";
export type InvitationPageFilter = {
  afterCreatedAt?: string;
  afterId?: string;
};
export type StaffPageFilter = InvitationPageFilter & {
  afterMemberId?: string;
  memberRole?: "owner" | "editor" | "viewer";
  invitationState?: "pending" | "expired" | "accepted" | "revoked";
};
export interface StaffPort {
  inbox(actor: Principal, filter?: InvitationPageFilter): Promise<unknown>;
  list(
    actor: Principal,
    org: string,
    filter?: StaffPageFilter,
  ): Promise<unknown>;
  invite(
    actor: Principal,
    org: string,
    key: string,
    input: { email: string; role: StaffRole },
  ): Promise<unknown>;
  accept(actor: Principal, id: string): Promise<unknown>;
  revoke(
    actor: Principal,
    org: string,
    id: string,
    version: number,
  ): Promise<unknown>;
  member(
    actor: Principal,
    org: string,
    id: string,
    version: string,
    role: StaffRole | "revoke",
  ): Promise<unknown>;
}
export class ProviderStaff {
  constructor(
    private identity: Access,
    private port: StaffPort,
  ) {}
  private async ownerSession(token: string | undefined) {
    const actor = await this.identity.authenticate(token);
    if (!actor.mfaVerified)
      throw new AppError(
        "MFA_REQUIRED",
        "Verify your authenticator before managing staff.",
        403,
      );
    return actor;
  }
  async inbox(token: string | undefined, filter: InvitationPageFilter = {}) {
    return this.port.inbox(await this.identity.authenticate(token), filter);
  }
  async list(
    token: string | undefined,
    org: string,
    filter: StaffPageFilter = {},
  ) {
    return this.port.list(await this.ownerSession(token), org, filter);
  }
  async invite(
    token: string | undefined,
    org: string,
    key: string,
    input: { email: string; role: StaffRole },
  ) {
    return this.port.invite(await this.ownerSession(token), org, key, input);
  }
  async accept(token: string | undefined, id: string) {
    return this.port.accept(await this.identity.authenticate(token), id);
  }
  async revoke(
    token: string | undefined,
    org: string,
    id: string,
    version: number,
  ) {
    return this.port.revoke(await this.ownerSession(token), org, id, version);
  }
  async member(
    token: string | undefined,
    org: string,
    id: string,
    version: string,
    role: StaffRole | "revoke",
  ) {
    return this.port.member(
      await this.ownerSession(token),
      org,
      id,
      version,
      role,
    );
  }
}
