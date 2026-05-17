import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import PerspectiveGrid from "@/components/PerspectiveGrid";
import AnimatedSphereWrapper from "@/components/AnimatedSphereWrapper";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <StarfieldBackground />

      {/* Nav */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <Link
          href="/"
          className="text-lg font-bold tracking-[0.35em] text-white/85 uppercase"
          style={{ textShadow: "0 0 18px rgba(139,92,246,0.55)" }}
        >
          Fortify
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="#how" className="text-gray-400 hover:text-white transition-colors">
            How it works
          </Link>
          <Link href="#frameworks" className="text-gray-400 hover:text-white transition-colors hidden sm:inline">
            Frameworks
          </Link>
          <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors hidden sm:inline">
            Pricing
          </Link>
          <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            style={{ boxShadow: "0 0 16px rgba(139,92,246,0.45)" }}
          >
            Start free trial
          </Link>
        </nav>
      </header>

      {/* Hero with sphere */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-6 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card text-xs text-violet-300 mb-6"
            style={{ boxShadow: "0 0 14px rgba(139,92,246,0.3)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Continuous compliance · AI-native · Healthcare-first
          </div>
          <h1
            className="text-5xl sm:text-6xl font-black leading-[1.05] tracking-tight text-white mb-6"
            style={{ textShadow: "0 0 30px rgba(139,92,246,0.4)" }}
          >
            HIPAA compliance that <span className="text-violet-300">runs itself</span>.
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed mb-8 max-w-xl">
            Fortify continuously verifies your security controls against HIPAA, SOC 2, ISO 27001, and GDPR — collecting evidence automatically, flagging drift the moment it happens, and keeping your practice audit-ready 24/7.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-lg px-6 py-3 transition-colors text-sm"
              style={{ boxShadow: "0 0 24px rgba(139,92,246,0.5)" }}
            >
              Start free trial →
            </Link>
            <Link
              href="#how"
              className="glass-card hover:bg-white/5 text-white font-medium rounded-lg px-6 py-3 transition-colors text-sm"
            >
              See how it works
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-5">
            14-day trial · No credit card · Built for solo practices, dental offices, therapy clinics, and healthcare MSPs
          </p>
        </div>

        <div className="relative flex items-center justify-center h-[420px] lg:h-[520px]">
          <AnimatedSphereWrapper />
        </div>
      </section>

      {/* "How it works" — three pillars */}
      <section id="how" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 text-center mb-2">How it works</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-12 leading-tight">
          Three jobs, one platform
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Pillar
            color="#8b5cf6"
            title="Virtual HIPAA officer"
            body="Translate the HIPAA Security Rule (and SOC 2, ISO, GDPR) into atomic technical controls. One control satisfies many requirements at once — so when MFA is on, four frameworks score up simultaneously."
          />
          <Pillar
            color="#3b82f6"
            title="24/7 security guard"
            body="Hourly drift scans across your environment. The moment encryption is disabled, MFA falls off a user, or a BAA expires, you know — with a remediation plan attached."
          />
          <Pillar
            color="#10b981"
            title="Audit-readiness engine"
            body="Audit-grade evidence captured automatically and tagged to the right requirements. When the auditor asks, you export the package — not assemble it from scratch."
          />
        </div>
      </section>

      {/* Frameworks */}
      <section id="frameworks" className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 text-center mb-2">Frameworks supported</p>
        <h2 className="text-2xl font-bold text-center text-white mb-8">Four frameworks. One control library.</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FrameworkBadge code="HIPAA" name="HIPAA Security Rule" color="#8b5cf6" />
          <FrameworkBadge code="SOC 2" name="AICPA Trust Services" color="#3b82f6" />
          <FrameworkBadge code="ISO 27001" name="ISO/IEC 27001:2022" color="#10b981" />
          <FrameworkBadge code="GDPR" name="EU Regulation 2016/679" color="#f97316" />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 text-center mb-2">Pricing</p>
        <h2 className="text-3xl font-bold text-center text-white mb-3">Built for healthcare budgets</h2>
        <p className="text-sm text-gray-500 text-center mb-10">
          One-tenth the price of enterprise compliance suites. All plans include all four frameworks.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PricingTier
            name="Solo"
            price="$1,800"
            cadence="/month"
            help="For solo practitioners"
            features={[
              "Unified HIPAA/SOC 2/ISO/GDPR controls",
              "Automated evidence collection",
              "Hourly drift monitoring",
              "Live threat intelligence",
              "Up to 3 team members",
            ]}
          />
          <PricingTier
            name="Practice"
            price="$3,500"
            cadence="/month"
            help="For 2–25 staff"
            featured
            features={[
              "Everything in Solo, plus:",
              "Vendor & BAA management",
              "Microsoft 365 integration",
              "Quarterly auditor exports",
              "Up to 25 team members",
              "Priority support",
            ]}
          />
          <PricingTier
            name="Multi-site"
            price="$6,000"
            cadence="/month"
            help="For MSPs & specialty groups"
            features={[
              "Everything in Practice, plus:",
              "Unlimited team members",
              "Multi-practice workspace",
              "Custom integrations",
              "Dedicated success manager",
              "Annual on-site audit prep",
            ]}
          />
        </div>
      </section>

      {/* Perspective grid floor */}
      <div className="relative z-0">
        <PerspectiveGrid />
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <p className="tracking-[0.25em] uppercase">Fortify · Compliance automation</p>
          <div className="flex items-center gap-6">
            <Link href="/security" className="hover:text-gray-400">
              Security posture
            </Link>
            <Link href="/login" className="hover:text-gray-400">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-gray-400">
              Start trial
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Pillar({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <div
      className="glass-card rounded-2xl p-6 hover:bg-white/[0.02] transition-colors"
      style={{ boxShadow: `0 0 20px ${color}18` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${color}1f`, boxShadow: `0 0 12px ${color}55` }}
      >
        <span style={{ color }} className="text-lg font-bold">
          ⌬
        </span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
    </div>
  );
}

function FrameworkBadge({ code, name, color }: { code: string; name: string; color: string }) {
  return (
    <div
      className="glass-card rounded-xl px-4 py-4 text-center"
      style={{ boxShadow: `inset 0 0 18px ${color}1a` }}
    >
      <p className="text-base font-bold" style={{ color }}>
        {code}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">{name}</p>
    </div>
  );
}

function PricingTier({
  name,
  price,
  cadence,
  help,
  features,
  featured = false,
}: {
  name: string;
  price: string;
  cadence: string;
  help: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className="glass-card rounded-2xl p-6"
      style={{
        boxShadow: featured ? "0 0 30px rgba(139,92,246,0.4)" : undefined,
        borderColor: featured ? "rgba(139,92,246,0.5)" : undefined,
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-lg font-semibold text-white">{name}</h3>
        {featured && (
          <span className="text-[10px] uppercase tracking-wider text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/15">
            Most popular
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">{help}</p>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-3xl font-black text-white tabular-nums">{price}</span>
        <span className="text-sm text-gray-500">{cadence}</span>
      </div>
      <ul className="space-y-2 mb-6">
        {features.map((f) => (
          <li key={f} className="text-sm text-gray-300 flex gap-2">
            <span className="text-violet-400 mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`block text-center text-sm font-medium rounded-lg px-4 py-2.5 transition-colors ${
          featured
            ? "bg-violet-500 hover:bg-violet-400 text-white"
            : "border border-white/15 hover:border-violet-400/40 text-white"
        }`}
      >
        Start free trial
      </Link>
    </div>
  );
}
