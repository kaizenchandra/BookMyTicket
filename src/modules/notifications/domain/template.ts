import { AppError } from "../../../shared/errors.ts";
export const notificationTypes = [
  "booking.confirmed",
  "booking.free_cancelled",
  "booking.pending_cancelled",
  "payment.recovery_required",
];
export function notificationTemplate(type: string) {
  switch (type) {
    case "booking.free_cancelled":
      return {
        title: "Free booking cancelled",
        body: "Your free booking was cancelled and its tickets revoked. No payment was collected, so no refund is due. Open the booking for current status.",
      };
    case "booking.confirmed":
      return {
        title: "Booking confirmation recorded",
        body: "Your booking was confirmed. Open the booking for its current status and tickets.",
      };
    case "booking.pending_cancelled":
      return {
        title: "Pending order cancelled",
        body: "Your pending order was cancelled. Open the booking for payment and recovery status; this notification does not confirm a refund.",
      };
    case "payment.recovery_required":
      return {
        title: "Payment requires review",
        body: "A captured payment needs recovery review. Open the booking for its current status. Refund completion has not been confirmed by this event.",
      };
    default:
      throw new AppError(
        "UNSUPPORTED_EVENT",
        "Notification event is unsupported.",
        422,
      );
  }
}
