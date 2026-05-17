import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import AnimatedSphereWrapper from "@/components/AnimatedSphereWrapper";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden grain">
      <StarfieldBackground />

      {/* Top nav — minimal, no background fill */}
      <header className="relative z-20 mx-auto max-w-7xl px-8 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-xl text-[var(--color-primary)] italic"
          style={{ letterSpacing: "-0.01em" }}
        >
          Fortify
        </Link>
        <nav className="flex items-center gap-8 text-sm">
          <Link href="#approach" className="text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors">
            Approach
          </Link>
          <Link href="#frameworks" className="text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors hidden sm:inline">
            Frameworks
          </Link>
          <Link href="/pricing" className="text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors hidden sm:inline">
            Pricing
          </Link>
          <Link href="/login" className="text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors">
            Sign in
          </Link>
          <ButtonLink href="/signup" size="sm" variant="primary">
            Begin trial
          </ButtonLink>
        </nav>
      </header>

      {/* Hero — editorial composition. Headline on the left, sphere as right column. */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 pt-8 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 animate-fade-in">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--color-tertiary)] mb-6">
            For healthcare practices · HIPAA · SOC 2 · ISO 27001 · GDPR
          </p>
          <h1
            className="font-display text-[var(--text-display-1)] leading-[0.95] text-[var(--color-primary)] mb-8"
            style={{ letterSpacing: "-0.025em" }}
          >
            Compliance,{" "}
            <span className="italic text-[var(--color-secondary)]">continuously</span> verified.
          </h1>
          <p className="text-[17px] text-[var(--color-secondary)] leading-relaxed max-w-xl mb-10">
            Fortify translates the HIPAA Security Rule — and three other frameworks — into atomic technical controls.
            One safeguard, verified once, satisfies many requirements at the same time.
            Evidence is collected automatically. Drift is caught the moment it happens.
            Your practice stays audit-ready, twenty-four hours a day.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/signup" variant="primary" size="lg">
              Start a 14-day trial →
            </ButtonLink>
            <ButtonLink href="#approach" variant="secondary" size="lg">
              See the approach
            </ButtonLink>
          </div>
          <p className="font-mono text-[11px] text-[var(--color-quaternary)] mt-6 tracking-wider">
            No credit card · solo · small · multi-site
          </p>
        </div>

        <div className="lg:col-span-5 relative h-[420px] lg:h-[560px] flex items-center justify-center">
          <AnimatedSphereWrapper />
        </div>
      </section>

      {/* Approach — three columns, editorial labels, generous spacing */}
      <section id="approach" className="relative z-10 mx-auto max-w-7xl px-8 py-24 border-t border-[var(--color-border-subtle)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--color-tertiary)] mb-3 text-center">
          The approach
        </p>
        <h2
          className="font-display text-[var(--text-display-2)] text-center text-[var(--color-primary)] mb-16 leading-[1.05]"
          style={{ letterSpacing: "-0.02em" }}
        >
          Three jobs,{" "}
          <span className="italic">one platform</span>.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--color-border-subtle)] rounded-2xl overflow-hidden surface">
          <Pillar
            roman="I"
            title="Virtual HIPAA officer"
            body="The Security Rule, SOC 2 TSC, ISO Annex A, and GDPR Article 32 distilled into atomic controls. One verification cascades across every framework that requirement maps to."
          />
          <Pillar
            roman="II"
            title="A 24-hour guard"
            body="Hourly drift scans across your environment. The moment encryption is disabled, MFA falls off a user, or a BAA expires, your dashboard knows — with a remediation plan attached."
          />
          <Pillar
            roman="III"
            title="Audit-readiness engine"
            body="Audit-grade evidence captured automatically and tagged to the right citation. When the auditor asks, you export the package. You no longer assemble it from scratch."
          />
        </div>
      </section>

      {/* Frameworks — restrained badge row */}
      <section id="frameworks" className="relative z-10 mx-auto max-w-5xl px-8 py-20 border-t border-[var(--color-border-subtle)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--color-tertiary)] mb-3 text-center">
          Frameworks supported
        </p>
        <h2 className="font-display text-3xl text-center text-[var(--color-primary)] mb-10" style={{ letterSpacing: "-0.02em" }}>
          Four frameworks. <span className="italic">One control library.</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--color-border-subtle)] surface rounded-xl overflow-hidden">
          <FrameworkCell code="HIPAA"     name="HIPAA Security Rule" />
          <FrameworkCell code="SOC 2"     name="AICPA Trust Services" />
          <FrameworkCell code="ISO 27001" name="ISO/IEC 27001:2022" />
          <FrameworkCell code="GDPR"      name="EU Regulation 2016/679" />
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="relative z-10 mx-auto max-w-3xl px-8 py-20 border-t border-[var(--color-border-subtle)] text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--color-tertiary)] mb-3">
          One-tenth of enterprise compliance suites
        </p>
        <h2 className="font-display text-3xl text-[var(--color-primary)] mb-6" style={{ letterSpacing: "-0.02em" }}>
          From <span className="italic">$1,800</span> a month.
        </h2>
        <p className="text-[var(--color-secondary)] text-[15px] leading-relaxed mb-8 max-w-xl mx-auto">
          Three tiers. All include HIPAA, SOC 2, ISO 27001, and GDPR. All include automated evidence, drift monitoring, and live threat intelligence.
        </p>
        <ButtonLink href="/pricing" variant="secondary" size="md">
          See pricing →
        </ButtonLink>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--color-border-subtle)] px-8 py-10 mt-12">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-[var(--color-tertiary)] uppercase tracking-[0.3em]">
          <p>Fortify · Compliance automation</p>
          <div className="flex items-center gap-8">
            <Link href="/security" className="hover:text-[var(--color-primary)] transition-colors">Our posture</Link>
            <Link href="/login" className="hover:text-[var(--color-primary)] transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-[var(--color-primary)] transition-colors">Begin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Pillar({ roman, title, body }: { roman: string; title: string; body: string }) {
  return (
    <div className="bg-[var(--color-canvas)] p-10 transition-colors hover:bg-[var(--color-surface-raised)]">
      <p className="font-display text-3xl italic text-[var(--color-accent)] mb-6" style={{ letterSpacing: "-0.02em" }}>
        {roman}
      </p>
      <h3 className="text-[var(--color-primary)] text-lg font-medium mb-3 leading-snug">{title}</h3>
      <p className="text-[var(--color-secondary)] text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function FrameworkCell({ code, name }: { code: string; name: string }) {
  return (
    <div className="bg-[var(--color-canvas)] py-8 px-4 text-center transition-colors hover:bg-[var(--color-surface-raised)]">
      <p className="font-display text-xl text-[var(--color-primary)]" style={{ letterSpacing: "-0.02em" }}>
        {code}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mt-2">
        {name}
      </p>
    </div>
  );
}
