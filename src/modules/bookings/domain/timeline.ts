export const bookingMilestoneKinds = [
  "created",
  "policies_accepted",
  "confirmed",
  "pending_cancelled",
  "free_cancelled",
] as const;
export type BookingMilestone = {
  kind: (typeof bookingMilestoneKinds)[number];
  occurredAt: string;
};
