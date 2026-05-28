/**
 * User-facing messages for the screening subsystem.
 *
 * The blocking message must be kind, vague, and never reveal the mechanism.
 * Disclosing that someone matched an exclusion list — even ambiguously — is
 * potentially defamatory if the match is wrong, and reveals operational
 * detail we don't want public.
 */

export const SCREENING_MESSAGES = {
  blockedFinal:
    "We're not able to complete your account setup at this time. " +
    "If you believe this is an error, please contact support@fortify.health and our team will follow up.",

  reviewRequired:
    "We need a few additional details to confirm your account.",

  reviewExplanation:
    "Please provide your middle name (if you have one) and the mailing address from your most recent tax return. " +
    "This helps us complete your setup quickly.",

  blockedAfterReview:
    "We're not able to complete your account setup at this time. " +
    "If you believe this is an error, please contact support@fortify.health and our team will follow up.",

  rescreenBlocked:
    "Your account access is paused while we re-verify a few details. We've notified your practice administrator.",
} as const;

export const ADMIN_MESSAGES = {
  workforceBlocked: (memberName: string) =>
    `${memberName}'s periodic compliance verification did not complete cleanly. Their workspace access is paused pending review. Open Fortify → Edit Staff to review.`,

  reviewRequired: (memberName: string) =>
    `${memberName} is partway through onboarding and needs additional verification. Reach out to them directly to provide it.`,
} as const;
