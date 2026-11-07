import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "../../../shared/errors.ts";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes: Uint8Array) {
  let bits = 0,
    value = 0,
    result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
export function decodeBase32(text: string) {
  let bits = 0,
    value = 0;
  const bytes: number[] = [];
  for (const c of text.toUpperCase().replace(/=+$/, "")) {
    const index = alphabet.indexOf(c);
    if (index < 0) throw new Error("Invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
export function hotp(secret: Uint8Array, counter: number, digits = 6) {
  const input = Buffer.alloc(8);
  input.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", secret).update(input).digest(),
    offset = hash[hash.length - 1] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits)
    .toString()
    .padStart(digits, "0");
}
export function matchingCounter(
  secret: Uint8Array,
  code: string,
  now: Date,
  lastCounter: number,
) {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = Math.floor(now.getTime() / 30000);
  let matched: number | null = null;
  for (const step of [counter - 1, counter, counter + 1]) {
    if (step < 0) continue;
    const valid = timingSafeEqual(
      Buffer.from(hotp(secret, step)),
      Buffer.from(code),
    );
    if (valid && step > lastCounter) matched = step;
  }
  return matched;
}
export class MfaSecrets {
  constructor(private encryptionKey = process.env.MFA_ENCRYPTION_KEY ?? "") {}
  private key() {
    if (!/^[a-f0-9]{64}$/i.test(this.encryptionKey))
      throw new AppError(
        "MFA_UNAVAILABLE",
        "Authenticator enrollment requires secure key configuration.",
        503,
      );
    return Buffer.from(this.encryptionKey, "hex");
  }
  generate() {
    this.key();
    return randomBytes(20);
  }
  seal(secret: Uint8Array, accountId: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    cipher.setAAD(Buffer.from(accountId));
    const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64",
    );
  }
  open(encoded: string, accountId: string) {
    const bytes = Buffer.from(encoded, "base64"),
      cipher = createDecipheriv(
        "aes-256-gcm",
        this.key(),
        bytes.subarray(0, 12),
      );
    cipher.setAAD(Buffer.from(accountId));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]);
  }
}
