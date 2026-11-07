import type { OtpDelivery } from "../application/authentication.ts";
import { AppError } from "../../../shared/errors.ts";
import { MailpitOtp } from "./mailpit.ts";
import { ResendOtp } from "./resend.ts";
export function otpDelivery(): OtpDelivery {
  const mode = process.env.OTP_DELIVERY ?? "resend";
  if (mode === "mailpit") return new MailpitOtp();
  if (mode === "resend") return new ResendOtp();
  return {
    available: () => false,
    send: async () => {
      throw new AppError(
        "OTP_UNAVAILABLE",
        "Email delivery mode is not configured.",
        503,
      );
    },
  };
}
export function localMailpitUrl() {
  if (
    process.env.OTP_DELIVERY !== "mailpit" ||
    !["development", "test"].includes(process.env.NODE_ENV ?? "")
  )
    return null;
  try {
    const url = new URL(process.env.MAILPIT_WEB_URL ?? "http://127.0.0.1:8025");
    return url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
