import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import { PLANS } from "@/lib/billing/plans";
import { getMarketingViewer } from "@/lib/auth/session";
import PricingCard from "./PricingCard";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const viewer = await getMarketingViewer();

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden grain">
      <StarfieldBackground />

      <MarketingNav viewer={viewer} />

      <main className="relative z-10 mx-auto max-w-6xl px-8 py-16">
        <div className="text-center mb-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--color-tertiary)] mb-3">
            Pricing
          </p>
          <h1
            className="font-display text-[var(--text-display-2)] text-[var(--color-primary)] leading-[1.05]"
            style={{ letterSpacing: "-0.025em" }}
          >
            Two plans. No add-ons.
          </h1>
          <p className="text-[var(--color-secondary)] text-[15px] mt-4 max-w-2xl mx-auto leading-relaxed">
            All-inclusive software, or all-inclusive software with in-person IT. Both include HIPAA, SOC 2, ISO 27001, and GDPR. Satisfaction guarantee — full refund within 30 days, no questions asked.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-violet-400 mt-5">
            Early bird · rate locks for the lifetime of your subscription
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {PLANS.map((p) => (
            <PricingCard key={p.id} plan={p} featured={p.id === "full_service"} />
          ))}
        </div>

        <div className="mt-12 max-w-3xl mx-auto px-6 py-5 surface rounded-xl text-center">
          <p className="text-sm text-[var(--color-secondary)]">
            Need on-prem, custom integrations, or multi-region deployment?{" "}
            <a href="mailto:sales@fortifynow.xyz" className="text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors">
              Talk to us
            </a>.
          </p>
        </div>
      </main>
    </div>
  );
}
