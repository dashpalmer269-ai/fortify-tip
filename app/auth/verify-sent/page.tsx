import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import { Card, CardBody } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function VerifyEmailSentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "";

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden grain">
      <StarfieldBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="px-8 py-6">
          <Link
            href="/"
            aria-label="Fortify — home"
            className="font-mono text-[14px] font-bold tracking-[0.45em] text-[var(--color-primary)] uppercase hover:text-violet-300 transition-colors"
          >
            Fortify
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md animate-fade-in">
            <Card>
              <CardBody className="py-10 text-center">
                {/* Glowing envelope mark */}
                <div className="mx-auto mb-7 w-16 h-16 rounded-full flex items-center justify-center"
                     style={{
                       background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)",
                     }}>
                  <div className="w-12 h-12 rounded-full bg-violet-500/15 border border-violet-400/40 flex items-center justify-center"
                       style={{ boxShadow: "0 0 24px rgba(139,92,246,0.4)" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 6-10 7L2 6" />
                    </svg>
                  </div>
                </div>

                <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-violet-300/80 mb-3">
                  Check your inbox
                </p>
                <h1 className="font-display text-3xl text-[var(--color-primary)] mb-3" style={{ letterSpacing: "-0.02em" }}>
                  Verify your email
                </h1>
                {email ? (
                  <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-2">
                    We sent a verification link to
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
                    We sent a verification link to your inbox.
                  </p>
                )}
                {email && (
                  <p className="font-mono text-[13px] text-[var(--color-primary)] mb-5 break-all">{email}</p>
                )}
                <p className="text-sm text-[var(--color-tertiary)] leading-relaxed">
                  Open the email and click the link to confirm your account. You&apos;ll be brought back here automatically.
                </p>

                <div className="mt-8 pt-6 border-t border-[var(--color-border-subtle)] text-left">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-2">
                    Didn&apos;t get it?
                  </p>
                  <ul className="text-xs text-[var(--color-tertiary)] space-y-1.5 leading-relaxed">
                    <li>· Check your spam or promotions folder</li>
                    <li>· Confirm you entered the correct email</li>
                    <li>· Wait 1–2 minutes — sometimes delivery is delayed</li>
                  </ul>
                </div>
              </CardBody>
            </Card>

            <p className="text-center mt-6 text-[13px] text-[var(--color-tertiary)]">
              Wrong email?{" "}
              <Link href="/signup" className="text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors">
                Start over
              </Link>
            </p>
          </div>
        </div>

        <div className="px-8 py-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-quaternary)]">
          Compliance automation · healthcare
        </div>
      </div>
    </div>
  );
}
