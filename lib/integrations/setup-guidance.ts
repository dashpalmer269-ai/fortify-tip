/**
 * Plain-language guided-setup content for each live integration.
 *
 * Surfaced on /app/integrations as an expandable "How to connect" panel.
 * Written for a non-technical practice owner: what you'll click, what
 * permission you're approving (and that it's read-only), what Fortify
 * checks once connected, and what compliance evidence that produces.
 *
 * Keyed by the same provider `key` used in the integrations page. A
 * provider without an entry simply shows no guided panel — safe default.
 */
export interface IntegrationGuidance {
  /** One friendly sentence on what connecting this does for them. */
  summary: string;
  /** Plain, ordered steps the user follows to connect. */
  steps: string[];
  /** What access they're granting — reassure it's read-only. */
  permissions: string;
  /** What Fortify automatically checks on a schedule once connected. */
  whatWeCheck: string[];
  /** What compliance evidence the integration produces. */
  evidenceCreated: string[];
  /** Roughly how long it takes. */
  timeEstimate: string;
}

export const INTEGRATION_GUIDANCE: Record<string, IntegrationGuidance> = {
  microsoft_365: {
    summary:
      "Connecting Microsoft 365 lets Fortify automatically check your email and account security — clearing dozens of controls with no manual work.",
    timeEstimate: "About 2 minutes",
    steps: [
      "Click the Connect button below.",
      "You'll be sent to Microsoft's sign-in page. Sign in with an account that has admin rights (usually the practice owner or IT person).",
      "Microsoft will show you exactly what Fortify can read. Review it and click Accept.",
      "You'll be brought back here and the badge will turn to Connected.",
    ],
    permissions:
      "Read-only. Fortify can see your security settings and account list, but cannot change anything, read email content, or access patient data.",
    whatWeCheck: [
      "Multi-factor authentication (MFA) is turned on for everyone",
      "No inactive or stale accounts left enabled",
      "Admin accounts are limited and protected",
      "No risky external guest access",
      "Mailbox forwarding rules that could leak data",
      "Security Defaults / Conditional Access are configured",
      "Device encryption (BitLocker) status",
      "Audit logging is enabled",
    ],
    evidenceCreated: [
      "MFA enforcement proof for HIPAA, SOC 2, ISO 27001",
      "Access-control and account-review evidence",
      "Audit-log availability attestation",
    ],
  },
  google_workspace: {
    summary:
      "Connecting Google Workspace lets Fortify automatically verify your account security settings across your whole organization.",
    timeEstimate: "About 2 minutes",
    steps: [
      "Click the Connect button below.",
      "Sign in with a Google account that has Super Admin rights.",
      "Review the read-only access Google describes and click Allow.",
      "You'll return here and the badge will read Connected.",
    ],
    permissions:
      "Read-only. Fortify reads admin and security reports only — never email, files, or patient data.",
    whatWeCheck: [
      "2-Step Verification is enforced",
      "Inactive accounts are cleaned up",
      "Admin roles are limited",
      "External file sharing is controlled",
      "Audit logs are available",
    ],
    evidenceCreated: [
      "2-Step Verification proof for HIPAA, SOC 2, ISO 27001",
      "Account-review and admin-access evidence",
      "Audit-log availability attestation",
    ],
  },
  okta: {
    summary:
      "Connecting Okta lets Fortify verify your single-sign-on and MFA policies automatically.",
    timeEstimate: "About 3 minutes",
    steps: [
      "In Okta, go to Security → API → Tokens and create a read-only API token.",
      "Copy the token and your Okta org URL (looks like yourcompany.okta.com).",
      "Paste both into the form below and click Connect.",
      "Fortify validates the token immediately and the badge turns to Connected.",
    ],
    permissions:
      "Read-only API token. Fortify reads your security policies and system log — it cannot modify users or settings.",
    whatWeCheck: [
      "MFA policy is enforced",
      "Admin roles are appropriately limited",
      "Inactive users are deactivated",
      "Password policy meets requirements",
      "System log is available for audits",
    ],
    evidenceCreated: [
      "MFA-policy proof for HIPAA, SOC 2, ISO 27001",
      "Privileged-access review evidence",
      "Authentication audit-log attestation",
    ],
  },
  aws: {
    summary:
      "Connecting AWS lets Fortify check your cloud security posture — public exposure, encryption, logging, and key hygiene.",
    timeEstimate: "About 5 minutes",
    steps: [
      "In AWS, create an IAM user with read-only access (the exact permissions are listed in the form).",
      "Generate an access key + secret for that user.",
      "Choose your default region.",
      "Paste the key, secret, and region into the form below. Fortify validates against AWS before saving.",
    ],
    permissions:
      "Read-only IAM credentials, scoped to security-relevant services only (CloudTrail, IAM, S3 settings, GuardDuty). No write access, no data access.",
    whatWeCheck: [
      "CloudTrail audit logging is on",
      "GuardDuty threat detection is enabled",
      "Root + IAM accounts have MFA",
      "No public S3 buckets",
      "S3 encryption is enabled",
      "Security groups aren't dangerously open",
      "Unused access keys are flagged",
    ],
    evidenceCreated: [
      "Cloud audit-logging proof for SOC 2, ISO 27001",
      "Encryption-at-rest evidence",
      "Public-exposure and key-hygiene findings",
    ],
  },
  docusign: {
    summary:
      "Connecting DocuSign lets Fortify automatically find your signed policies, BAAs, and attestations as proof of completion.",
    timeEstimate: "About 3 minutes",
    steps: [
      "Click the Connect button below.",
      "Sign in to DocuSign and approve read-only access.",
      "You'll return here and the badge will read Connected.",
      "Fortify scans your completed compliance envelopes weekly.",
    ],
    permissions:
      "Read-only. Fortify reads envelope completion status and document metadata — it does not send, sign, or alter documents.",
    whatWeCheck: [
      "Policies have been signed by staff",
      "BAAs are executed with vendors",
      "Attestations are completed on schedule",
    ],
    evidenceCreated: [
      "Signed-policy proof for HIPAA workforce requirements",
      "Executed-BAA evidence for vendor management",
      "Completed-attestation records",
    ],
  },
};
