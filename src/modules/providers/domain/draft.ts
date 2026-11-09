import { AppError } from "../../../shared/errors.ts";
export function requireEditableOrganization(state: string) {
  if (!["draft", "changes_requested"].includes(state))
    throw new AppError(
      "ORGANIZATION_NOT_EDITABLE",
      "Only drafts and organizations awaiting corrections can be edited or submitted.",
      409,
    );
}
