import { AppError } from "../../../shared/errors.ts";
export type OnboardingDetails = {
  legalName: string;
  businessAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};
export function requireCompleteOnboarding(
  details: OnboardingDetails | undefined,
) {
  if (
    !details?.legalName.trim() ||
    !details.businessAddress.trim() ||
    !details.contactName.trim() ||
    !details.contactEmail.trim()
  )
    throw new AppError(
      "ONBOARDING_INCOMPLETE",
      "Save a business name, business address, contact person and email in the private onboarding form before submitting or approving.",
      422,
    );
}
