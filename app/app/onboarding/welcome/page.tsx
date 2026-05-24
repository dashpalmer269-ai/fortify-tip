import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import StarfieldBackground from "@/components/StarfieldBackground";
import { Card, CardBody } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function OnboardingWelcomePage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding");

  const supabase = await createAuthedServerClient();
  const { data: practice } = await supabase
    .from("practices")
    .select("name, selected_plan")
    .eq("id", session.membership.practice_id)
    .single();

  const practiceName = practice?.name ?? "your practice";

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
      <div className="opacity-60">
        <StarfieldBackground />
      </div>
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 30%, rgba(139,92,246,0.22) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-8 py-6 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
          <Link
            href="/"
            aria-label="Fortify — home"
            className="font-mono text-[14px] font-bold tracking-[0.45em] text-[var(--color-primary)] uppercase hover:text-violet-300 transition-colors"
          >
            Fortify
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-2xl text-center animate-fade-in">
            {/* Glow mark */}
            <div
              className="mx-auto mb-10 w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background:
                  "radial-gradient(circle, rgba(139,92,246,0.32) 0%, transparent 70%)",
              }}
            >
              <div
                className="w-14 h-14 rounded-full bg-violet-500/20 border border-violet-400/60 flex items-center justify-center"
                style={{ boxShadow: "0 0 32px rgba(139,92,246,0.55)" }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e9d5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-violet-300/80 mb-5">
              Welcome aboard
            </p>
            <h1
              className="font-display text-[clamp(40px,5vw,68px)] text-[var(--color-primary)] leading-[1.02] mb-6"
              style={{ letterSpacing: "-0.03em" }}
            >
              {practiceName} is live<br />
              <span className="italic text-violet-200">on Fortify.</span>
            </h1>
            <p className="text-[15px] text-[var(--color-secondary)] leading-[1.7] max-w-lg mx-auto mb-12">
              Your workspace is ready. The healthcare-baseline control library is pre-loaded, your dashboard is set up,
              and audit-log tracking is live from this moment forward.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12 text-left">
              <NextStep
                title="See your readiness"
                body="Per-framework scores and critical findings."
                href="/app"
              />
              <NextStep
                title="Run risk assessment"
                body="5-minute wizard with AI exec summary."
                href="/app/risk-assessment/new"
              />
              <NextStep
                title="Add your team"
                body="Invite admins, officers, staff."
                href="/app/team"
              />
            </div>

            <ButtonLink href="/app" variant="primary" size="lg">
              Enter your workspace →
            </ButtonLink>
          </div>
        </main>
      </div>
    </div>
  );
}

function NextStep({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link href={href}>
      <Card variant="default" className="p-5 hover:bg-[var(--color-surface-raised)] transition-colors h-full">
        <p className="font-display text-[15px] text-[var(--color-primary)] mb-1" style={{ letterSpacing: "-0.01em" }}>
          {title}
        </p>
        <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">{body}</p>
      </Card>
    </Link>
  );
}
