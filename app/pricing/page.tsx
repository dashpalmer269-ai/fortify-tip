import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import { PLANS } from "@/lib/billing/plans";
import { ButtonLink } from "@/components/ui/Button";
import PricingCard from "./PricingCard";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden grain">
      <StarfieldBackground />

      <header className="relative z-20 mx-auto max-w-7xl px-8 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-xl text-[var(--color-primary)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          Fortify
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/login" className="text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors">Sign in</Link>
          <ButtonLink href="/signup" size="sm" variant="primary">Sign Up</ButtonLink>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-8 py-16">
        <div className="text-center mb-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--color-tertiary)] mb-3">
            Pricing
          </p>
          <h1
            className="font-display text-[var(--text-display-2)] text-[var(--color-primary)] leading-[1.05]"
            style={{ letterSpacing: "-0.025em" }}
          >
            One-tenth of enterprise <br/> compliance suites.
          </h1>
          <p className="text-[var(--color-secondary)] text-[15px] mt-4 max-w-2xl mx-auto leading-relaxed">
            All plans include HIPAA, SOC 2, ISO 27001, and GDPR. Cancel any time. Healthcare-focused support included.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <PricingCard key={p.id} plan={p} featured={p.id === "practice"} />
          ))}
        </div>

        <div className="mt-12 max-w-3xl mx-auto px-6 py-5 surface rounded-xl text-center">
          <p className="text-sm text-[var(--color-secondary)]">
            Need on-prem, custom integrations, or multi-region deployment?{" "}
            <a href="mailto:sales@fortify.example" className="text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors">
              Talk to us
            </a>.
          </p>
        </div>
      </main>
    </div>
  );
}
