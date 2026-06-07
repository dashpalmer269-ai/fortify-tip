/**
 * Source-of-truth for pricing tiers. Used by:
 *   - the marketing landing
 *   - the /pricing page
 *   - the in-app /app/billing screen
 *   - the Stripe checkout route handler
 *   - the invite-link demo grant
 *
 * Each tier maps to a Stripe Price ID that you create in the Stripe dashboard
 * and inject via env vars. Until those env vars are set, the checkout route
 * returns a 503 and surfaces a clear "billing not configured yet" message.
 *
 * Pricing is "Early Bird" — these rates lock in for the customer's lifetime
 * (or until we publicly publish them as the new standard, whichever first).
 */
export interface Plan {
  id: "software" | "full_service";
  name: string;
  description: string;
  monthly_price_usd: number;
  features: string[];
  badge?: string;
  stripe_price_env: string;
}

export const PLANS: Plan[] = [
  {
    id: "software",
    name: "Software",
    description: "All-inclusive Fortify platform",
    monthly_price_usd: 555,
    badge: "Early bird",
    features: [
      "Unified HIPAA / SOC 2 / ISO 27001 / GDPR control library",
      "Automated evidence collection from M365, Google, AWS, Okta, DocuSign",
      "Daily drift monitoring + live threat intelligence",
      "Policy authoring + acknowledgment tracking",
      "Workforce training (HIPAA Security, Privacy, Breach, Phishing)",
      "Quarterly auditor-ready exports",
      "Unlimited team members",
      "Email support",
    ],
    stripe_price_env: "STRIPE_PRICE_SOFTWARE",
  },
  {
    id: "full_service",
    name: "Full Service",
    description: "Software + in-person IT & help desk",
    monthly_price_usd: 1333,
    badge: "Early bird",
    features: [
      "Everything in Software, plus:",
      "On-site IT services (regional)",
      "Dedicated help desk",
      "White-glove onboarding",
      "Quarterly on-site compliance review",
      "Direct line to your compliance officer",
    ],
    stripe_price_env: "STRIPE_PRICE_FULL_SERVICE",
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function priceIdFor(plan: Plan): string | null {
  return process.env[plan.stripe_price_env] ?? null;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && PLANS.every((p) => priceIdFor(p));
}

/**
 * What a redeemed invite grants — same access surface as the Software tier
 * for the duration of the demo. Distinguished from a real subscription by
 * the practice's plan_source = 'invite' flag.
 */
export const DEMO_PLAN_ID: Plan["id"] = "software";
