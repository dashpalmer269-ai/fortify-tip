/**
 * Source-of-truth for pricing tiers. Used by:
 *   - the marketing landing
 *   - the in-app /app/billing screen
 *   - the Stripe checkout route handler
 *
 * Each tier maps to a Stripe Price ID that you create in the Stripe dashboard
 * and inject via env vars. Until those env vars are set, the checkout route
 * returns a 503 and surfaces a clear "billing not configured yet" message.
 */
export interface Plan {
  id: "solo" | "practice" | "multisite";
  name: string;
  description: string;
  monthly_price_usd: number;
  features: string[];
  badge?: string;
  stripe_price_env: string;
}

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    description: "For solo practitioners",
    monthly_price_usd: 1800,
    features: [
      "Unified HIPAA / SOC 2 / ISO / GDPR controls",
      "Automated evidence collection",
      "Daily drift monitoring",
      "Live threat intelligence",
      "Up to 3 team members",
    ],
    stripe_price_env: "STRIPE_PRICE_SOLO",
  },
  {
    id: "practice",
    name: "Practice",
    description: "For 2–25 staff",
    monthly_price_usd: 3500,
    badge: "Most popular",
    features: [
      "Everything in Solo, plus:",
      "Vendor & BAA management",
      "Microsoft 365 integration",
      "Quarterly auditor exports",
      "Up to 25 team members",
      "Priority support",
    ],
    stripe_price_env: "STRIPE_PRICE_PRACTICE",
  },
  {
    id: "multisite",
    name: "Multi-site",
    description: "For MSPs & specialty groups",
    monthly_price_usd: 6000,
    features: [
      "Everything in Practice, plus:",
      "Unlimited team members",
      "Multi-practice workspace",
      "Custom integrations",
      "Dedicated success manager",
      "Annual on-site audit prep",
    ],
    stripe_price_env: "STRIPE_PRICE_MULTISITE",
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
