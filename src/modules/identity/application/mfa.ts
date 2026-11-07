import { AppError } from "../../../shared/errors.ts";
export interface MfaStore {
  status(token: string): Promise<unknown>;
  begin(token: string): Promise<unknown>;
  confirm(token: string, enrollmentId: string, code: string): Promise<unknown>;
  verify(token: string, code: string): Promise<unknown>;
  recover(token: string, code: string): Promise<unknown>;
}
export class Mfa {
  constructor(private store: MfaStore) {}
  status(token: string) {
    return this.store.status(token);
  }
  begin(token: string) {
    return this.store.begin(token);
  }
  private code(code: string) {
    if (!/^\d{6}$/.test(code))
      throw new AppError(
        "INVALID_MFA_CODE",
        "Enter a six-digit authenticator code.",
        422,
      );
  }
  async confirm(token: string, id: string, code: string) {
    this.code(code);
    return this.store.confirm(token, id, code);
  }
  async verify(token: string, code: string) {
    this.code(code);
    return this.store.verify(token, code);
  }
  async recover(token: string, code: string) {
    if (!/^[a-f0-9]{32}$/.test(code))
      throw new AppError(
        "INVALID_RECOVERY_CODE",
        "Enter a valid recovery code.",
        422,
      );
    return this.store.recover(token, code);
  }
}
