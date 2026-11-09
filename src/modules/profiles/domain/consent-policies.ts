// Published consent wording is versioned: changes require a new version.
export const consentPolicies = {
  marketing_email: {
    version: 1,
    text: "I agree to receive optional offers and recommendations by email. I can withdraw this permission here at any time.",
  },
  saved_attendees: {
    version: 1,
    text: "I consent to storing these details in my account for reuse in future booking forms (policy version 1).",
  },
} as const;
