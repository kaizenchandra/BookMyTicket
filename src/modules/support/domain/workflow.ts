import { AppError } from "../../../shared/errors.ts";
export type CaseAction =
  "claim" | "release" | "escalate" | "resolve" | "reopen" | "priority";
export type Priority = "low" | "normal" | "high" | "urgent";
export function transitionCase(
  row: { state: string; assigned_to: string | null; priority: Priority },
  actor: string,
  action: CaseAction,
  priority?: Priority,
) {
  const next = { ...row };
  if (action === "reopen") {
    if (row.state !== "resolved")
      throw new AppError("CONFLICT", "Only resolved cases can be reopened.");
    return { ...next, state: "open", assigned_to: null };
  }
  if (row.state === "resolved")
    throw new AppError("CONFLICT", "Reopen this case before making changes.");
  if (row.assigned_to && row.assigned_to !== actor)
    throw new AppError("CONFLICT", "Another agent owns this case.");
  if (action === "claim")
    return {
      ...next,
      assigned_to: actor,
      state: row.state === "escalated" ? "escalated" : "in_progress",
    };
  if (row.assigned_to !== actor)
    throw new AppError("CONFLICT", "Claim this case before making changes.");
  if (action === "release")
    return {
      ...next,
      assigned_to: null,
      state: row.state === "escalated" ? "escalated" : "open",
    };
  if (action === "escalate")
    return { ...next, assigned_to: null, state: "escalated" };
  if (action === "resolve") return { ...next, state: "resolved" };
  if (!priority) throw new AppError("VALIDATION", "Choose a priority.", 400);
  return { ...next, priority };
}
