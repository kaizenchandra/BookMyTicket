import { AppError } from "../../../shared/errors.ts";
export function requireEscalatable(state: string) {
  if (state === "resolved")
    throw new AppError(
      "CONFLICT",
      "Reply to reopen the case before requesting escalation.",
      409,
    );
  if (state === "escalated")
    throw new AppError(
      "ALREADY_ESCALATED",
      "This case is already in the escalated queue.",
      409,
    );
  if (!["open", "in_progress"].includes(state))
    throw new AppError("CONFLICT", "This case cannot be escalated.", 409);
}
