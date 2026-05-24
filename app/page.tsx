import Link from "next/link";
import CosmicOrb from "@/components/CosmicOrb";
import StarfieldBackground from "@/components/StarfieldBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import { ButtonLink } from "@/components/ui/Button";
import { getMarketingViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const viewer = await getMarketingViewer();
  return (
    <div className="relative min-h-screen bg-[#04031a] text-white overflow-hidden font-marketing">
      {/* ── Atmospheric backdrop — three layered radial washes ── */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 78% 26%, rgba(139,92,246,0.28) 0%, transparent 60%),
            radial-gradient(ellipse 55% 40% at 12% 80%, rgba(80,40,180,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 110% 60% at 50% 110%, rgba(76,29,149,0.26) 0%, transparent 70%)
          `,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 30% at 30% 50%, rgba(167,139,250,0.09) 0%, transparent 65%)",
          animation: "ambient-shift 20s ease-in-out infinite",
        }}
      />
      <StarfieldBackground />
      {/* Grain — barely-there texture */}
      <div
        className="absolute inset-0 pointer-events-none z-[2] opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      <MarketingNav active="features" viewer={viewer} />

      {/* ────────────────── HERO ─ full viewport ────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 min-h-[88vh] flex items-start">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-16 lg:gap-12 items-center w-full pt-10 lg:pt-16 pb-16 lg:pb-0">
          <div className="max-w-xl">
            <h1
              className="font-marketing text-[clamp(48px,6.5vw,88px)] text-white mb-20"
              style={{
                letterSpacing: "-0.035em",
                fontWeight: 700,
                lineHeight: "1.06",
                paddingBottom: "0.12em",  /* descender breathing room */
                fontVariationSettings: '"SOFT" 35, "opsz" 144',
              }}
            >
              <span className="block">Healthcare</span>
              <span className="block italic text-violet-200 mt-2" style={{ fontWeight: 500 }}>
                compliance,
              </span>
              <span className="block mt-2">
                <span className="text-white/85">made</span> simple.
              </span>
            </h1>

            <p className="text-[16px] text-white/65 leading-[1.7] mb-10 max-w-md font-sans">
              Verified instrument for HIPAA, SOC 2, ISO 27001, and GDPR. Continuous monitoring. Remediation automation. Verifiable evidence. Your practice stays audit-ready.
            </p>

            <ul className="space-y-3.5 mb-10 font-sans">
              <Bullet>24/7 Security Assurance</Bullet>
              <Bullet>Automated Compliance Monitoring</Bullet>
              <Bullet>Policies, Training, More</Bullet>
            </ul>

            {/* Single primary CTA + subtle secondary as text link */}
            <div className="flex flex-wrap items-center gap-6">
              <ButtonLink href="/signup" variant="primary" size="lg">
                Sign Up →
              </ButtonLink>
              <Link
                href="#about"
                className="text-[14px] text-white/65 hover:text-white transition-colors font-sans border-b border-white/15 hover:border-white/40 pb-0.5"
              >
                Contact Us
              </Link>
            </div>

            <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">
              No credit card · cancel any time
            </p>
          </div>

          <div className="relative h-[440px] sm:h-[520px] lg:h-[700px] -mx-6 sm:-mx-8 lg:mx-0">
            <CosmicOrb />
          </div>
        </div>
      </section>

      {/* ────────────────── STATS STRIP ─ instrument-panel proof ────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 py-20 sm:py-28">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.08] rounded-2xl overflow-hidden">
          <Stat value="4" unit="Frameworks" detail="HIPAA · SOC 2 · ISO · GDPR" />
          <Stat value="200+" unit="Controls" detail="One library, every mapping" />
          <Stat value="24 / 7" unit="Monitoring" detail="Drift caught in minutes" />
          <Stat value="0" unit="Spreadsheets" detail="Evidence captured live" />
        </div>
      </section>

      {/* ────────────────── FEATURES ─ editorial 3+2 grid ────────────────── */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 py-24 sm:py-36">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-12 lg:gap-20 mb-20">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-violet-300/70 mb-6">
              Capabilities
            </p>
            <h2
              className="font-marketing text-[clamp(36px,4.4vw,58px)] leading-[1] text-white"
              style={{ letterSpacing: "-0.03em", fontWeight: 700 }}
            >
              Five jobs.<br />
              <span className="italic text-violet-200" style={{ fontWeight: 500 }}>
                One platform.
              </span>
            </h2>
          </div>
          <div className="flex items-end">
            <p className="text-[16px] text-white/60 leading-[1.7] max-w-lg font-sans">
              Compliance, security, and IT operations united under a single instrument. Built for practices that can&apos;t afford a security team — and shouldn&apos;t need to.
            </p>
          </div>
        </div>

        {/* 3-up on top row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/[0.08] rounded-t-2xl overflow-hidden">
          <NumberedFeature n="01" title="Automated Compliance" body="One control verified once satisfies many requirements across all four frameworks." />
          <NumberedFeature n="02" title="24/7 Monitoring" body="Drift alerts the moment encryption, MFA, or backup posture changes." />
          <NumberedFeature n="03" title="Risk Management" body="Guided risk analysis with AI executive summary and remediation plan." />
        </div>
        {/* 2-up on bottom row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/[0.08] rounded-b-2xl overflow-hidden border-t border-white/[0.08]">
          <NumberedFeature n="04" title="Policies & Training" body="AI-drafted policies for your practice, with acknowledgment tracking." />
          <NumberedFeature n="05" title="Backup & Recovery" body="Validate backups, attest restores, and prove continuity automatically." />
        </div>
      </section>

      {/* ────────────────── HOW IT WORKS ─ 3 steps ────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 py-24 sm:py-36">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-violet-300/70 mb-5">
            How it works
          </p>
          <h2
            className="font-marketing text-[clamp(34px,4vw,52px)] leading-[1.03] text-white"
            style={{ letterSpacing: "-0.03em", fontWeight: 700 }}
          >
            Three steps to{" "}
            <span className="italic text-violet-200" style={{ fontWeight: 500 }}>
              audit-ready
            </span>.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-16">
          <Step
            n="01"
            title="Connect"
            body="Sign in once and link Microsoft 365, your backup provider, and any other system. Fortify maps your environment to the control library automatically."
          />
          <Step
            n="02"
            title="Verify"
            body="Hourly checks run quietly in the background — verifying MFA, encryption, audit logs, backup health. Drift becomes a notification, not a discovery during an audit."
          />
          <Step
            n="03"
            title="Export"
            body="When the auditor knocks, you export the evidence packet — policies, attestations, drift history, executive summary. Audit-ready in seconds."
          />
        </div>
      </section>

      {/* ────────────────── CTA ─ the closing event ────────────────── */}
      <section
        id="about"
        className="relative z-10 mx-auto max-w-5xl px-6 sm:px-8 py-32 sm:py-44 text-center"
      >
        <div
          className="relative rounded-[28px] py-20 sm:py-28 px-8 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 50% 40%, rgba(139,92,246,0.22) 0%, transparent 75%), linear-gradient(180deg, rgba(20,8,52,0.5) 0%, rgba(10,4,30,0.2) 100%)",
            border: "1px solid rgba(167,139,250,0.18)",
            boxShadow:
              "0 0 80px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
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
          <p className="text-[16px] text-white/65 leading-[1.7] mb-12 max-w-xl mx-auto font-sans">
            Join a growing community of healthcare practices automating compliance, reducing risk, and protecting patient data — in days, not months.
          </p>
          <ButtonLink href="/signup" variant="primary" size="lg">
            Sign Up →
          </ButtonLink>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/35 mt-6">
            No credit card · cancel any time
          </p>
        </div>
      </section>

      {/* ────────────────── FOOTER ────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.08] mt-12">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 py-16 sm:py-20 grid grid-cols-2 sm:grid-cols-4 gap-10 sm:gap-12 font-sans">
          <div className="col-span-2 sm:col-span-1">
            <Link
              href="/"
              className="font-mono text-[13px] font-bold tracking-[0.45em] text-white uppercase hover:text-violet-200 transition-colors block mb-5"
            >
              Fortify
            </Link>
            <p className="text-xs text-white/55 leading-[1.7] max-w-xs">
              Compliance, security, and IT operations — unified for healthcare.
            </p>
            <div className="flex items-center gap-3 mt-7 text-white/40">
              <a href="#" aria-label="LinkedIn" className="hover:text-white transition-colors"><SocialIcon kind="linkedin" /></a>
              <a href="#" aria-label="X (Twitter)" className="hover:text-white transition-colors"><SocialIcon kind="x" /></a>
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
          <div className="mx-auto max-w-7xl px-6 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/40 font-sans">
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

function Stat({ value, unit, detail }: { value: string; unit: string; detail: string }) {
  return (
    <div className="bg-[#04031a] px-6 py-8 sm:px-8 sm:py-10">
      <p
        className="font-marketing text-[clamp(36px,5vw,56px)] tabular-nums text-white leading-none mb-3"
        style={{ letterSpacing: "-0.03em", fontWeight: 700 }}
      >
        {value}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-violet-300/80 mb-1.5">
        {unit}
      </p>
      <p className="text-[12px] text-white/45 font-sans leading-relaxed">{detail}</p>
    </div>
  );
}

function NumberedFeature({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bg-[#04031a] p-8 sm:p-10 hover:bg-white/[0.025] transition-colors flex flex-col h-full">
      <p
        className="font-marketing text-2xl text-violet-300/55 mb-8"
        style={{ letterSpacing: "-0.02em", fontWeight: 500 }}
      >
        {n}
      </p>
      <h3
        className="font-marketing text-[20px] text-white mb-3"
        style={{ letterSpacing: "-0.015em", fontWeight: 600 }}
      >
        {title}
      </h3>
      <p className="text-[13px] text-white/55 leading-[1.75] font-sans">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="relative">
      <div className="flex items-baseline gap-4 mb-5">
        <span
          className="font-marketing text-2xl text-violet-300/60"
          style={{ letterSpacing: "-0.02em", fontWeight: 500 }}
        >
          {n}
        </span>
        <span className="flex-1 h-px bg-white/[0.08]" />
      </div>
      <h3
        className="font-marketing text-[24px] text-white mb-3"
        style={{ letterSpacing: "-0.02em", fontWeight: 600 }}
      >
        {title}
      </h3>
      <p className="text-[14px] text-white/60 leading-[1.7] font-sans max-w-sm">{body}</p>
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
