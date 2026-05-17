import Link from "next/link";
import CosmicOrb from "@/components/CosmicOrb";
import StarfieldBackground from "@/components/StarfieldBackground";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#04031a] text-white overflow-hidden font-marketing">
      {/* ── Atmospheric backdrop — layered radial washes + drifting ambient ── */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 75% 28%, rgba(139,92,246,0.32) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 12% 85%, rgba(80,40,180,0.22) 0%, transparent 60%),
            radial-gradient(ellipse 90% 60% at 50% 110%, rgba(76,29,149,0.28) 0%, transparent 70%)
          `,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 30% at 30% 50%, rgba(167,139,250,0.10) 0%, transparent 65%)",
          animation: "ambient-shift 18s ease-in-out infinite",
        }}
      />
      <StarfieldBackground />
      {/* Grain overlay — texture, almost invisible */}
      <div
        className="absolute inset-0 pointer-events-none z-[2] opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header className="relative z-30 mx-auto max-w-7xl px-8 py-7 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Fortify">
          <span className="relative w-[18px] h-[18px] flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-violet-500/30 blur-md" />
            <span className="relative w-2.5 h-2.5 rounded-full bg-violet-300" />
          </span>
          <span className="font-mono text-[12px] font-semibold tracking-[0.45em] text-white uppercase">
            Fortify
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-[13px] text-white/65 font-sans">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/intel" className="hover:text-white transition-colors">Intel</Link>
          <Link href="#about" className="hover:text-white transition-colors">About</Link>
        </nav>
        <Link
          href="/login"
          className="text-[13px] text-white/80 hover:text-white transition-colors font-sans"
        >
          Login
        </Link>
      </header>

      {/* ────────────────── HERO ─ full viewport ────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 min-h-[88vh] flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-16 lg:gap-12 items-center w-full">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-violet-300/70 mb-9">
              For healthcare · est. 2026
            </p>
            <h1
              className="font-marketing text-[clamp(52px,7vw,96px)] leading-[0.93] text-white mb-9"
              style={{
                letterSpacing: "-0.04em",
                fontWeight: 700,
                fontVariationSettings: '"SOFT" 35, "opsz" 144',
              }}
            >
              Healthcare<br />
              <span className="italic text-violet-200" style={{ fontWeight: 500 }}>compliance</span>,<br />
              <span className="text-white/85">made</span> simple.
            </h1>
            <p className="text-[16px] text-white/60 leading-[1.65] mb-10 max-w-md font-sans">
              One instrument for HIPAA, SOC 2, ISO 27001, and GDPR. Continuous monitoring, automated evidence, AI-assisted remediation. Your practice stays audit-ready twenty-four hours a day.
            </p>

            <ul className="space-y-3.5 mb-10 font-sans">
              <Bullet>24/7 security monitoring</Bullet>
              <Bullet>Automated evidence collection</Bullet>
              <Bullet>Policies, training, risk &amp; more</Bullet>
            </ul>

            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="/signup" variant="primary" size="lg">
                Get started →
              </ButtonLink>
              <Link
                href="#about"
                className="inline-flex items-center h-12 px-5 text-[14px] text-white/85 hover:text-white border border-white/15 hover:border-white/30 rounded-lg transition-all font-sans"
              >
                Contact us
              </Link>
            </div>

            {/* Trust markers — integrated under CTAs */}
            <div className="flex items-center gap-6 mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">
              <span className="flex items-center gap-2"><Pip /> Secure</span>
              <span className="flex items-center gap-2"><Pip /> Compliant</span>
              <span className="flex items-center gap-2"><Pip /> Reliable</span>
            </div>
          </div>

          <div className="relative h-[480px] lg:h-[720px] -mx-8 lg:mx-0">
            <CosmicOrb />
          </div>
        </div>
      </section>

      {/* ────────────────── FEATURES ─ numbered editorial grid ────────────────── */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-8 py-44">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-16 lg:gap-20 mb-24">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-violet-300/70 mb-6">
              Capabilities
            </p>
            <h2
              className="font-marketing text-[clamp(40px,5vw,68px)] leading-[0.98] text-white"
              style={{ letterSpacing: "-0.035em", fontWeight: 700 }}
            >
              Five jobs.<br />
              <span className="italic text-violet-200" style={{ fontWeight: 500 }}>
                One platform.
              </span>
            </h2>
          </div>
          <div className="flex items-end">
            <p className="text-[16px] text-white/60 leading-[1.7] max-w-lg font-sans">
              Compliance, security, and IT operations united under a single instrument. Built for the practices that can&apos;t afford a full security team and shouldn&apos;t need to.
            </p>
          </div>
        </div>

        {/* Five borderless tiles separated by hairline dividers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-white/[0.08] rounded-2xl overflow-hidden">
          <NumberedFeature n="01" title="Automated Compliance" body="One control verified once satisfies many requirements across all four frameworks." />
          <NumberedFeature n="02" title="24/7 Monitoring" body="Drift alerts the moment encryption, MFA, or backup posture changes." />
          <NumberedFeature n="03" title="Risk Management" body="Guided risk analysis with AI executive summary and remediation plan." />
          <NumberedFeature n="04" title="Policies & Training" body="AI-drafted policies for your practice, with acknowledgment tracking." />
          <NumberedFeature n="05" title="Backup & Recovery" body="Validate backups, attest restores, and prove continuity automatically." />
        </div>
      </section>

      {/* ────────────────── CTA ─ atmospheric closing moment ────────────────── */}
      <section
        id="about"
        className="relative z-10 mx-auto max-w-5xl px-8 py-48 text-center"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(139,92,246,0.16) 0%, transparent 75%)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-violet-300/70 mb-7">
          Begin
        </p>
        <h2
          className="font-marketing text-[clamp(40px,5.5vw,76px)] leading-[0.96] text-white mb-9"
          style={{ letterSpacing: "-0.04em", fontWeight: 700 }}
        >
          Ready to{" "}
          <span className="italic text-violet-200" style={{ fontWeight: 500 }}>
            secure
          </span>{" "}
          your practice?
        </h2>
        <p className="text-[16px] text-white/60 leading-[1.7] mb-12 max-w-xl mx-auto font-sans">
          Join a growing community of healthcare practices automating compliance, reducing risk, and protecting patient data — in days, not months.
        </p>
        <ButtonLink href="/signup" variant="primary" size="lg">
          Begin a 14-day trial →
        </ButtonLink>
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/35 mt-5">
          No credit card · cancel any time
        </p>
      </section>

      {/* ────────────────── FOOTER ────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.08] mt-32">
        <div className="mx-auto max-w-7xl px-8 py-20 grid grid-cols-2 sm:grid-cols-4 gap-12 font-sans">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="relative w-[18px] h-[18px] flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-violet-500/30 blur-md" />
                <span className="relative w-2.5 h-2.5 rounded-full bg-violet-300" />
              </span>
              <span className="font-mono text-[11px] font-semibold tracking-[0.45em] text-white uppercase">
                Fortify
              </span>
            </div>
            <p className="text-xs text-white/55 leading-[1.7] max-w-xs">
              Compliance, security, and IT operations — unified for healthcare.
            </p>
            <div className="flex items-center gap-3 mt-7 text-white/40">
              <a href="#" aria-label="LinkedIn" className="hover:text-white transition-colors"><SocialIcon kind="linkedin" /></a>
              <a href="#" aria-label="X" className="hover:text-white transition-colors"><SocialIcon kind="x" /></a>
              <a href="#" aria-label="GitHub" className="hover:text-white transition-colors"><SocialIcon kind="github" /></a>
            </div>
          </div>

          <FooterCol title="Platform" links={[
            ["Features",   "#features"],
            ["Compliance", "/app/compliance"],
            ["Intel",      "/intel"],
            ["Pricing",    "/pricing"],
          ]} />
          <FooterCol title="Resources" links={[
            ["Help Center",   "#"],
            ["Documentation", "#"],
            ["Templates",     "#"],
            ["Blog",          "#"],
          ]} />
          <FooterCol title="Company" links={[
            ["About",   "#about"],
            ["Contact", "#about"],
            ["Privacy", "#"],
            ["Terms",   "#"],
          ]} />
        </div>
        <div className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/40 font-sans">
            <p>© 2026 Fortify. All rights reserved.</p>
            <p className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(16,185,129,0.7)" }} />
              HIPAA-compliant infrastructure
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Local presentation components
   ────────────────────────────────────────────────────────────────────────── */

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-[14px] text-white/85">
      <span className="w-5 h-5 rounded-full bg-violet-500/15 border border-violet-400/40 flex items-center justify-center shrink-0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {children}
    </li>
  );
}

function Pip() {
  return (
    <span
      className="w-1 h-1 rounded-full bg-violet-300/70"
      style={{ boxShadow: "0 0 6px rgba(167,139,250,0.7)" }}
    />
  );
}

function NumberedFeature({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bg-[#04031a] p-8 hover:bg-white/[0.025] transition-colors flex flex-col h-full">
      <p
        className="font-marketing text-2xl text-violet-300/55 mb-8"
        style={{ letterSpacing: "-0.02em", fontWeight: 500 }}
      >
        {n}
      </p>
      <h3
        className="font-marketing text-[19px] text-white mb-3"
        style={{ letterSpacing: "-0.015em", fontWeight: 600 }}
      >
        {title}
      </h3>
      <p className="text-xs text-white/55 leading-[1.7] font-sans">{body}</p>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-white mb-5">{title}</p>
      <ul className="space-y-3">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13px] text-white/55 hover:text-white transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialIcon({ kind }: { kind: "linkedin" | "x" | "github" }) {
  if (kind === "linkedin") return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v4H4zM4 10h4v10H4zM10 10h4v1.5c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.7 2.3 4.7 5.3V20h-4v-4.6c0-1.3-.5-2.2-1.8-2.2-1.4 0-2.2.9-2.2 2.2V20h-4z"/></svg>;
  if (kind === "x") return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 2H22l-7.5 8.6L23 22h-7l-5.5-7.2L4 22H.5l8-9.2L1 2h7.2L13 8.7zm-1.2 18h2.1L7 4H4.8z"/></svg>;
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.6 2 12.3c0 4.6 2.9 8.4 7 9.8.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5.1 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5 4-1.4 7-5.2 7-9.8C22 6.6 17.5 2 12 2z"/></svg>;
}
