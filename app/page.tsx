import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import MedicalSphere from "@/components/MedicalSphere";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#04031a] text-white overflow-hidden">
      {/* Atmospheric background — soft radial washes */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 75% 30%, rgba(139,92,246,0.22) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 20% 85%, rgba(80,40,180,0.14) 0%, transparent 55%), radial-gradient(ellipse 100% 80% at 50% 100%, rgba(76,29,149,0.18) 0%, transparent 70%)",
        }}
      />
      <StarfieldBackground />

      {/* Top navigation */}
      <header className="relative z-20 mx-auto max-w-7xl px-8 py-7 flex items-center justify-between">
        <Link href="/" className="font-mono text-[12px] font-semibold tracking-[0.4em] text-white uppercase">
          Fortify
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-[13px] text-white/65">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/intel" className="hover:text-white transition-colors">Intel</Link>
          <Link href="#about" className="hover:text-white transition-colors">About</Link>
        </nav>
        <Link href="/login" className="text-[13px] text-white/80 hover:text-white transition-colors">
          Login
        </Link>
      </header>

      {/* ────────────────── HERO ────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 pt-24 pb-48 lg:pt-32 lg:pb-56 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-20 lg:gap-16 items-center min-h-[88vh]">
        <div className="max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-violet-300/80 mb-8">
            Healthcare compliance · simplified
          </p>
          <h1
            className="font-display text-[clamp(44px,5.8vw,76px)] text-white leading-[1.02] mb-8"
            style={{ letterSpacing: "-0.025em" }}
          >
            Healthcare <span className="text-violet-300">compliance</span>, made simple.<br />
            <span className="text-white/70">Security</span>, made strong.
          </h1>
          <p className="text-[15px] text-white/65 leading-relaxed mb-12 max-w-lg">
            One platform for HIPAA, SOC 2, ISO 27001, and GDPR. Continuous monitoring, automated evidence, and AI-assisted remediation — so your practice stays audit-ready twenty-four hours a day.
          </p>

          <ul className="space-y-4 mb-12">
            <Bullet>24/7 security monitoring</Bullet>
            <Bullet>Automated evidence collection</Bullet>
            <Bullet>Policies, training, risk &amp; more</Bullet>
          </ul>

          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink href="/signup" variant="primary" size="lg">
              Get started
            </ButtonLink>
            <Link
              href="#about"
              className="inline-flex items-center h-12 px-5 text-[14px] text-white/80 hover:text-white border border-white/15 hover:border-white/30 rounded-lg transition-colors"
            >
              Contact us
            </Link>
          </div>
        </div>

        <div className="relative h-[440px] lg:h-[640px] -mx-8 lg:mx-0">
          <MedicalSphere />
        </div>
      </section>

      <SectionDivider />

      {/* ────────────────── TRUST STRIP ────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-8 py-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
          <Trust icon={<ShieldIcon />} label="Secure" />
          <Trust icon={<CheckSealIcon />} label="Compliant" />
          <Trust icon={<HubIcon />} label="Reliable" />
        </div>
      </section>

      <SectionDivider />

      {/* ────────────────── FEATURES ────────────────── */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-8 py-40">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-violet-300/80 mb-6">
            One platform
          </p>
          <h2
            className="font-display text-[clamp(36px,4.4vw,56px)] text-white leading-[1.02] mb-8"
            style={{ letterSpacing: "-0.025em" }}
          >
            Everything you need.{" "}
            <span
              className="italic"
              style={{
                background: "linear-gradient(90deg,#e9d5ff 0%,#a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              In one place.
            </span>
          </h2>
          <p className="text-[15px] text-white/60 leading-relaxed max-w-xl mx-auto">
            Fortify brings compliance, security, and IT operations under a single instrument so your team can focus on patients — not paperwork.
          </p>
        </div>

        {/* Features — borderless tiles with subtle dividers between */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
          <FeatureTile icon={<AutomationIcon />} title="Automated Compliance" body="One control verified once satisfies many requirements across all four frameworks." />
          <FeatureTile icon={<MonitorIcon />} title="24/7 Monitoring" body="Drift alerts the moment encryption, MFA, or backup posture changes." />
          <FeatureTile icon={<RiskIcon />} title="Risk Management" body="Guided risk analysis with AI executive summary and remediation plan." />
          <FeatureTile icon={<DocsIcon />} title="Policies &amp; Training" body="AI-drafted policies for your practice, with acknowledgment tracking." />
          <FeatureTile icon={<BackupIcon />} title="Backup &amp; Recovery" body="Validate backups, attest restores, and prove continuity automatically." />
        </div>
      </section>

      <SectionDivider />

      {/* ────────────────── CTA BANNER ────────────────── */}
      <section
        id="about"
        className="relative z-10 mx-auto max-w-4xl px-8 py-40 text-center"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(139,92,246,0.12) 0%, transparent 70%)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-violet-300/80 mb-6">
          Begin
        </p>
        <h2
          className="font-display text-[clamp(32px,4vw,48px)] text-white leading-[1.05] mb-7"
          style={{ letterSpacing: "-0.025em" }}
        >
          Ready to <span className="italic text-violet-200">secure</span> your practice?
        </h2>
        <p className="text-[15px] text-white/60 leading-relaxed mb-12 max-w-xl mx-auto">
          Join a growing community of healthcare practices automating compliance, reducing risk, and protecting patient data — in days, not months.
        </p>
        <ButtonLink href="/signup" variant="primary" size="lg">
          Begin a 14-day trial
        </ButtonLink>
      </section>

      {/* ────────────────── FOOTER ────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.06] mt-24">
        <div className="mx-auto max-w-7xl px-8 py-20 grid grid-cols-2 sm:grid-cols-4 gap-12">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-mono text-[11px] font-semibold tracking-[0.4em] text-white uppercase mb-4">
              Fortify
            </p>
            <p className="text-xs text-white/55 leading-relaxed max-w-xs">
              Compliance, security, and IT operations — unified for healthcare.
            </p>
            <div className="flex items-center gap-3 mt-6 text-white/45">
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
          <div className="mx-auto max-w-7xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/45">
            <p>© 2026 Fortify. All rights reserved.</p>
            <p className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
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

function SectionDivider() {
  return (
    <div className="relative z-10 mx-auto max-w-3xl px-8 py-2 flex items-center justify-center" aria-hidden>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div
        className="mx-4 w-1.5 h-1.5 rounded-full bg-violet-400/40"
        style={{ boxShadow: "0 0 12px rgba(139,92,246,0.55)" }}
      />
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

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

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-violet-300 w-10 h-10 rounded-full bg-violet-500/8 border border-violet-500/20 flex items-center justify-center">
        {icon}
      </span>
      <span className="font-mono text-[11px] font-medium tracking-[0.3em] text-white/70 uppercase">
        {label}
      </span>
    </div>
  );
}

function FeatureTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-[#04031a] p-8 hover:bg-white/[0.02] transition-colors">
      <span className="inline-flex w-10 h-10 rounded-md bg-violet-500/12 items-center justify-center text-violet-300 mb-6">
        {icon}
      </span>
      <h3 className="font-display text-[18px] text-white mb-3" style={{ letterSpacing: "-0.015em" }}>
        {title}
      </h3>
      <p className="text-xs text-white/55 leading-[1.7]">{body}</p>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white mb-5">{title}</p>
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

/* ── Icons ─────────────────────────────────────────────────────────────────── */
function ShieldIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>;
}
function CheckSealIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 3 4-1 1 4 3 3-3 3-1 4-4-1-3 3-3-3-4 1-1-4-3-3 3-3 1-4 4 1z"/><polyline points="9 12 11 14 15 10"/></svg>;
}
function HubIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="7" y1="6.5" x2="10.5" y2="10.5"/><line x1="17" y1="6.5" x2="13.5" y2="10.5"/><line x1="7" y1="17.5" x2="10.5" y2="13.5"/><line x1="17" y1="17.5" x2="13.5" y2="13.5"/></svg>;
}
function AutomationIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function MonitorIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
}
function RiskIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function DocsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}
function BackupIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/></svg>;
}
function SocialIcon({ kind }: { kind: "linkedin" | "x" | "github" }) {
  if (kind === "linkedin") return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v4H4zM4 10h4v10H4zM10 10h4v1.5c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.7 2.3 4.7 5.3V20h-4v-4.6c0-1.3-.5-2.2-1.8-2.2-1.4 0-2.2.9-2.2 2.2V20h-4z"/></svg>;
  if (kind === "x") return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 2H22l-7.5 8.6L23 22h-7l-5.5-7.2L4 22H.5l8-9.2L1 2h7.2L13 8.7zm-1.2 18h2.1L7 4H4.8z"/></svg>;
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.6 2 12.3c0 4.6 2.9 8.4 7 9.8.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5.1 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5 4-1.4 7-5.2 7-9.8C22 6.6 17.5 2 12 2z"/></svg>;
}
