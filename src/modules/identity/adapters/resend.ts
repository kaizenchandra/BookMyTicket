import { AppError } from "../../../shared/errors.ts";
import type { OtpDelivery } from "../application/authentication.ts";
export class ResendOtp implements OtpDelivery {
  available() {
    return Boolean(process.env.RESEND_API_KEY && process.env.OTP_FROM);
  }
  async send(contact: string, code: string) {
    if (!this.available())
      throw new AppError(
        "OTP_UNAVAILABLE",
        "Email verification is not configured. No code has been sent.",
        503,
      );
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.OTP_FROM,
        to: [contact],
        subject: "Your BookMyTicket verification code",
        text: `Your verification code is ${code}. It expires in 5 minutes. Do not share this code.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new AppError(
        "OTP_DELIVERY_FAILED",
        "The verification provider did not accept delivery. Try again later.",
        503,
      );
  }
}
