import { AppError } from "../../../shared/errors.ts";
export const notificationTypes = [
  "support.case_assigned",
  "support.staff_replied",
  "booking.confirmed",
  "booking.free_cancelled",
  "booking.pending_cancelled",
  "payment.recovery_required",
];
export type NotificationCategory = "booking" | "payment" | "support";
export const notificationCategories: Record<NotificationCategory, string[]> = {
  booking: [
    "booking.confirmed",
    "booking.free_cancelled",
    "booking.pending_cancelled",
  ],
  payment: ["payment.recovery_required"],
  support: ["support.case_assigned", "support.staff_replied"],
};
export function notificationTemplate(type: string) {
  switch (type) {
    case "support.case_assigned":
      return {
        title: "Support assignment recorded",
        body: "A supervisor assigned a case to you. Open the support workspace to check its current assignment and status. Your current permissions and MFA are required; this notice does not grant access.",
      };
    case "support.staff_replied":
      return {
        title: "Support replied to your case",
        body: "A customer-visible reply was recorded. Open your support case to read the conversation and check its current status.",
      };
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
