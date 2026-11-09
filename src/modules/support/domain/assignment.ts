import { AppError } from "../../../shared/errors.ts";
export function assignedState(state: string) {
  if (state === "resolved")
    throw new AppError("CONFLICT", "Reopen the case before assigning it.", 409);
  if (!["open", "in_progress", "escalated"].includes(state))
    throw new AppError("CONFLICT", "This case cannot be assigned.", 409);
  return state === "escalated" ? "escalated" : "in_progress";
}
