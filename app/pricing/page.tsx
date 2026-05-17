import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import { PLANS } from "@/lib/billing/plans";
import PricingCard from "./PricingCard";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <StarfieldBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link
          href="/"
          className="text-lg font-bold tracking-[0.35em] text-white/85 uppercase"
          style={{ textShadow: "0 0 18px rgba(139,92,246,0.55)" }}
        >
          Fortify
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-gray-400 hover:text-white">Sign in</Link>
          <Link
            href="/signup"
            className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            style={{ boxShadow: "0 0 16px rgba(139,92,246,0.45)" }}
          >
            Start free trial
          </Link>
        </nav>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-violet-400 mb-2">Pricing</p>
          <h1
            className="text-4xl sm:text-5xl font-black tracking-tight text-white"
            style={{ textShadow: "0 0 24px rgba(139,92,246,0.4)" }}
          >
            One-tenth the price of enterprise compliance.
          </h1>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
            All plans include HIPAA, SOC 2, ISO 27001, and GDPR. Cancel anytime. Healthcare-focused support included.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <PricingCard key={p.id} plan={p} featured={p.id === "practice"} />
          ))}
        </div>

        <div className="mt-12 max-w-3xl mx-auto rounded-2xl bg-violet-500/5 border border-violet-500/20 px-6 py-5 text-center">
          <p className="text-sm text-gray-300">
            Need on-prem, custom integrations, or multi-region deployment?{" "}
            <a href="mailto:sales@fortify.example" className="text-violet-300 hover:text-violet-200">
              Talk to us
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
