import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import StarfieldBackground from "@/components/StarfieldBackground";
import { Card, CardBody } from "@/components/ui/Card";
import { SCREENING_MESSAGES } from "@/lib/screening/user-message";

export const dynamic = "force-dynamic";

/**
 * The blocked endpoint. Intentionally vague — never reveal the mechanism.
 * No "Continue" affordance. Sign-out is the only action.
 */
export default async function ScreeningBlockedPage() {
  const session = await getAppSession();
  if (session.kind === "unauthenticated") redirect("/login");

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
      <div className="opacity-30"><StarfieldBackground /></div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
          <Link href="/" className="font-mono text-[14px] font-bold tracking-[0.45em] text-[var(--color-primary)] uppercase">
            Fortify
          </Link>
        </header>

        <main className="flex-1 max-w-lg w-full mx-auto px-6 sm:px-8 py-16">
          <div className="mb-8 flex justify-center">
            <div
              className="w-14 h-14 rounded-full border border-[var(--color-tertiary)]/30 bg-[var(--color-surface)] flex items-center justify-center"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-tertiary)]">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-[clamp(28px,3vw,38px)] text-[var(--color-primary)] leading-[1.15] mb-4" style={{ letterSpacing: "-0.02em" }}>
              We&apos;re unable to complete your account setup
            </h1>
            <p className="text-[15px] text-[var(--color-secondary)] leading-[1.7]">
              {SCREENING_MESSAGES.blockedFinal}
            </p>
          </div>

          <Card>
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-3">
                Need help?
              </p>
              <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
                Email us at{" "}
                <a className="text-[var(--color-primary)] underline" href="mailto:support@fortify.health">
                  support@fortify.health
                </a>{" "}
                and our team will respond personally within one business day.
              </p>
            </CardBody>
          </Card>

          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/" className="text-[13px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors">
              Return home
            </Link>
            <span className="text-[var(--color-quaternary)]">·</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-[13px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
