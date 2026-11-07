import nodemailer from "nodemailer";
import type { OtpDelivery } from "../application/authentication.ts";
import { AppError } from "../../../shared/errors.ts";
// Explicit development mail capture, never a production delivery fallback.
export class MailpitOtp implements OtpDelivery {
  constructor(private env: NodeJS.ProcessEnv = process.env) {}
  available() {
    return (
      ["development", "test"].includes(this.env.NODE_ENV ?? "") &&
      this.env.OTP_DELIVERY === "mailpit" &&
      Boolean(this.env.MAILPIT_SMTP_HOST && this.env.OTP_FROM)
    );
  }
  async send(contact: string, code: string) {
    if (!this.available())
      throw new AppError(
        "OTP_UNAVAILABLE",
        "Local email capture is not configured or is prohibited in this environment.",
        503,
      );
    const transport = nodemailer.createTransport({
      host: this.env.MAILPIT_SMTP_HOST,
      port: Number(this.env.MAILPIT_SMTP_PORT ?? 1025),
      secure: false,
      ignoreTLS: true,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail({
        from: this.env.OTP_FROM,
        to: contact,
        subject: "Your BookMyTicket verification code",
        text: `Your verification code is ${code}. It expires in 5 minutes. Do not share this code.\n\nThis message was captured by local development Mailpit. It was not delivered to an external inbox.`,
      });
      if (!result.accepted.length) throw new Error("Not accepted");
    } catch {
      throw new AppError(
        "OTP_DELIVERY_FAILED",
        "The local email service did not confirm delivery. Check Mailpit and request a new code after the cooldown.",
        503,
      );
    } finally {
      transport.close();
    }
  }
}
