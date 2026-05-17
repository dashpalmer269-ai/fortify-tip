import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import AnimatedSphereWrapper from "@/components/AnimatedSphereWrapper";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#04031a] text-white overflow-hidden">
      {/* Background atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 70% 35%, rgba(139,92,246,0.18) 0%, rgba(4,3,26,0) 55%), radial-gradient(ellipse at 20% 80%, rgba(99,52,200,0.12) 0%, rgba(4,3,26,0) 50%)",
        }}
      />
      <StarfieldBackground />

      {/* Top navigation */}
      <header className="relative z-20 mx-auto max-w-7xl px-8 py-6 flex items-center justify-between">
        <Link href="/" className="text-[15px] font-bold tracking-[0.35em] text-white uppercase">
          Fortify
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-sm text-white/70">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/app/threats" className="hover:text-white transition-colors">Intel</Link>
          <Link href="#about" className="hover:text-white transition-colors">About</Link>
        </nav>
        <Link
          href="/login"
          className="text-sm text-white/80 hover:text-white transition-colors"
        >
          Login
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 pt-10 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
            Healthcare <span className="text-[#a78bfa]">Compliance</span><br />
            Made Simple.<br />
            Security Made Strong.
          </h1>
          <p className="text-[15px] text-white/65 leading-relaxed mb-7 max-w-xl">
            The all-in-one platform that helps healthcare practices stay secure, compliant, and audit-ready with continuous monitoring across HIPAA, SOC 2, ISO 27001, and GDPR — and removes compliance overhead.
          </p>

          <ul className="space-y-3 mb-9">
            <Bullet>24/7 Security Monitoring</Bullet>
            <Bullet>Automated Evidence Collection</Bullet>
            <Bullet>Policies, Training, Risk &amp; More</Bullet>
          </ul>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/signup" variant="primary" size="lg">
              Get Started
            </ButtonLink>
            <Link
              href="#about"
              className="inline-flex items-center justify-center h-12 px-6 text-[15px] rounded-lg border border-white/20 text-white hover:bg-white/[0.04] hover:border-white/30 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>

        {/* Sphere with medical cross overlay */}
        <div className="relative flex items-center justify-center h-[440px] lg:h-[560px]">
          <AnimatedSphereWrapper />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <MedicalCross />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="relative z-10 mx-auto max-w-5xl px-8 py-8 border-y border-white/[0.06]">
        <div className="grid grid-cols-3 gap-6">
          <Trust icon={<ShieldIcon />} label="Secure" />
          <Trust icon={<CheckSealIcon />} label="Compliant" />
          <Trust icon={<HubIcon />} label="Reliable" />
        </div>
      </section>

      {/* Everything You Need */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-8 py-24 text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.05] tracking-tight">
          Everything You Need.
        </h2>
        <p
          className="text-4xl sm:text-5xl italic font-medium leading-[1.05] tracking-tight mt-2"
          style={{
            background: "linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          All In One Platform.
        </p>
        <p className="text-[15px] text-white/60 leading-relaxed mt-6 max-w-2xl mx-auto">
          Fortify brings together compliance, security, and IT management so you can focus on patient care — not paperwork.
        </p>

        {/* Feature cards — 5 across on desktop, scrolls down on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-12 text-left">
          <FeatureCard icon={<AutomationIcon />} title="Automated Compliance" body="Continuously monitor controls across HIPAA, SOC 2, ISO 27001, and GDPR." />
          <FeatureCard icon={<MonitorIcon />} title="24/7 Security Monitoring" body="Drift alerts the moment encryption, MFA, or backup posture changes." />
          <FeatureCard icon={<RiskIcon />} title="Risk Management" body="Guided risk analysis with AI-written executive summary and remediation plan." />
          <FeatureCard icon={<DocsIcon />} title="Policies &amp; Training" body="AI-drafted policies tailored to your practice, with acknowledgment tracking." />
          <FeatureCard icon={<BackupIcon />} title="Backup &amp; Recovery" body="Validate backups, attest restores, and prove continuity automatically." />
        </div>
      </section>

      {/* CTA banner */}
      <section id="about" className="relative z-10 mx-auto max-w-3xl px-8 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
          Ready to Secure Your Practice?
        </h2>
        <p className="text-[15px] text-white/60 leading-relaxed mb-8 max-w-xl mx-auto">
          Join a growing community of healthcare practices automating compliance, reducing risk, and protecting patient data &mdash; in days, not months.
        </p>
        <ButtonLink href="/signup" variant="primary" size="lg">
          Get Started
        </ButtonLink>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] mt-10">
        <div className="mx-auto max-w-7xl px-8 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[14px] font-bold tracking-[0.3em] text-white uppercase mb-3">Fortify</p>
            <p className="text-xs text-white/55 leading-relaxed max-w-xs">
              The all-in-one compliance and cybersecurity platform built for small and mid-sized healthcare practices.
            </p>
            <div className="flex items-center gap-3 mt-5 text-white/45">
              <a href="#" aria-label="LinkedIn" className="hover:text-white transition-colors"><SocialIcon kind="linkedin" /></a>
              <a href="#" aria-label="X" className="hover:text-white transition-colors"><SocialIcon kind="x" /></a>
              <a href="#" aria-label="GitHub" className="hover:text-white transition-colors"><SocialIcon kind="github" /></a>
            </div>
          </div>

          <FooterCol title="Platform" links={[
            ["Features", "#features"],
            ["Compliance", "/app/compliance"],
            ["Threat Intel", "/app/threats"],
            ["Pricing", "/pricing"],
          ]} />
          <FooterCol title="Resources" links={[
            ["Help Center", "#"],
            ["Documentation", "#"],
            ["Templates", "#"],
            ["Blog", "#"],
          ]} />
          <FooterCol title="Company" links={[
            ["About", "#about"],
            ["Contact", "#about"],
            ["Privacy", "#"],
            ["Terms", "#"],
          ]} />
        </div>
        <div className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/45">
            <p>© 2026 Fortify. All rights reserved.</p>
            <p className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              HIPAA Compliant
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Local components
   ────────────────────────────────────────────────────────────────────────── */

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-[14px] text-white/85">
      <span className="w-5 h-5 rounded-full bg-[rgba(139,92,246,0.18)] border border-[rgba(139,92,246,0.4)] flex items-center justify-center shrink-0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {children}
    </li>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-[#a78bfa]">{icon}</span>
      <span className="text-[13px] font-medium tracking-[0.25em] text-white/75 uppercase">{label}</span>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      className="rounded-xl p-5 border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.04] hover:border-white/[0.15] transition-colors"
    >
      <span className="inline-flex w-9 h-9 rounded-lg bg-[rgba(139,92,246,0.12)] items-center justify-center text-[#a78bfa] mb-4">
        {icon}
      </span>
      <h3 className="text-[14px] font-semibold text-white mb-2">{title}</h3>
      <p className="text-xs text-white/55 leading-relaxed">{body}</p>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white mb-3">{title}</p>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-xs text-white/55 hover:text-white transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Icons
   ────────────────────────────────────────────────────────────────────────── */

function MedicalCross() {
  return (
    <div
      className="relative w-32 h-32 lg:w-40 lg:h-40 flex items-center justify-center"
      style={{
        filter: "drop-shadow(0 0 35px rgba(139,92,246,0.7)) drop-shadow(0 0 70px rgba(139,92,246,0.35))",
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="text-[#a78bfa]">
        <defs>
          <linearGradient id="cross-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e9d5ff" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {/* Soft halo */}
        <circle cx="50" cy="50" r="40" fill="rgba(139,92,246,0.08)" />
        {/* Cross */}
        <path
          d="M40 18 H60 V40 H82 V60 H60 V82 H40 V60 H18 V40 H40 Z"
          fill="url(#cross-grad)"
          stroke="rgba(233,213,255,0.7)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function CheckSealIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 3 4-1 1 4 3 3-3 3-1 4-4-1-3 3-3-3-4 1-1-4-3-3 3-3 1-4 4 1z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
function HubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <line x1="7" y1="6.5" x2="10.5" y2="10.5" />
      <line x1="17" y1="6.5" x2="13.5" y2="10.5" />
      <line x1="7" y1="17.5" x2="10.5" y2="13.5" />
      <line x1="17" y1="17.5" x2="13.5" y2="13.5" />
    </svg>
  );
}

function AutomationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function MonitorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}
function RiskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function DocsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function BackupIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15" />
    </svg>
  );
}

function SocialIcon({ kind }: { kind: "linkedin" | "x" | "github" }) {
  if (kind === "linkedin") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 4h4v4H4zM4 10h4v10H4zM10 10h4v1.5c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.7 2.3 4.7 5.3V20h-4v-4.6c0-1.3-.5-2.2-1.8-2.2-1.4 0-2.2.9-2.2 2.2V20h-4z" />
      </svg>
    );
  }
  if (kind === "x") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.5 2H22l-7.5 8.6L23 22h-7l-5.5-7.2L4 22H.5l8-9.2L1 2h7.2L13 8.7zm-1.2 18h2.1L7 4H4.8z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.5 2 2 6.6 2 12.3c0 4.6 2.9 8.4 7 9.8.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5.1 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5 4-1.4 7-5.2 7-9.8C22 6.6 17.5 2 12 2z" />
    </svg>
  );
}
