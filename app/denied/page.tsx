import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import StarfieldBackground from "@/components/StarfieldBackground";
import { Card, CardBody } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function DeniedAccessPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

  // Approved users go to the dashboard.
  if (session.membership) redirect("/app");

  const supabase = await createAuthedServerClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("status, pending_practice_name, claimed_admin_name, denial_reason")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // Only denied users see this page.
  if (profile?.status !== "denied") redirect("/pending");

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
      <div className="opacity-40">
        <StarfieldBackground />
      </div>
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 20%, rgba(248,113,113,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
          <Link
            href="/"
            aria-label="Fortify — home"
            className="font-mono text-[14px] font-bold tracking-[0.45em] text-[var(--color-primary)] uppercase hover:text-violet-300 transition-colors"
          >
            Fortify
          </Link>
          <p className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-quaternary)]">
            {session.user.email}
          </p>
        </header>

        <main className="flex-1 max-w-2xl w-full mx-auto px-6 sm:px-8 py-12">
          <div className="mb-8 flex justify-center">
            <div
              className="w-16 h-16 rounded-full border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 flex items-center justify-center"
              style={{ boxShadow: "0 0 28px rgba(248,113,113,0.18)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
          </div>

          <div className="text-center mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-[var(--color-danger)]/80 mb-3">
              Access not granted
            </p>
            <h1
              className="font-display text-[clamp(34px,4vw,52px)] text-[var(--color-primary)] leading-[1.02] mb-4"
              style={{ letterSpacing: "-0.025em" }}
            >
              Your request was declined.
            </h1>
            <p className="text-[15px] text-[var(--color-secondary)] leading-[1.7] max-w-md mx-auto">
              An administrator at{" "}
              <span className="text-[var(--color-primary)] font-medium">
                {profile?.pending_practice_name ?? "the practice you requested"}
              </span>{" "}
              did not approve your access. If this is a mistake, contact{" "}
              <span className="text-[var(--color-primary)]">{profile?.claimed_admin_name ?? "your administrator"}</span>{" "}
              directly.
            </p>
          </div>

          {profile?.denial_reason && (
            <Card className="mb-6">
              <CardBody>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-3">
                  Reason from the administrator
                </p>
                <p className="text-sm text-[var(--color-primary)] leading-relaxed">{profile.denial_reason}</p>
              </CardBody>
            </Card>
          )}

          <Card className="mb-8">
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-4">
                What you can do
              </p>
              <ul className="space-y-3 text-sm text-[var(--color-secondary)]">
                <Step>Contact your administrator to discuss your request directly.</Step>
                <Step>If you used the wrong practice name, sign out and create a new account with the correct details.</Step>
                <Step>For help, email <a className="underline" href="mailto:support@fortify.health">support@fortify.health</a>.</Step>
              </ul>
            </CardBody>
          </Card>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonLink href="/" variant="secondary" size="md" className="min-w-[160px]">
              Return Home
            </ButtonLink>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-[13px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]/70 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}
