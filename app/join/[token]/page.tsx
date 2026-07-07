import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import { findPendingInviteByToken } from "@/lib/billing/team-invites";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import StarfieldBackground from "@/components/StarfieldBackground";
import { Card, CardBody } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import AcceptInviteButton from "./AcceptInviteButton";

export const dynamic = "force-dynamic";

/**
 * Public landing page for an emailed team invite (/join/<token>).
 *
 * Valid token → show who's inviting and as what role, then branch:
 *   signed out            → sign-up / log-in CTAs (redemption happens
 *                           silently in /auth/callback via email match)
 *   signed in, match      → Accept button (POST /api/invites/redeem)
 *   signed in, mismatch   → tell them which email to use
 * Invalid/expired token   → friendly dead-end.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const db = createServiceClient();
  const invite = db ? await findPendingInviteByToken(db, token) : null;

  let practiceName: string | null = null;
  if (invite && db) {
    const { data } = await db
      .from("practices")
      .select("name")
      .eq("id", invite.practice_id)
      .maybeSingle();
    practiceName = data?.name ?? null;
  }

  const session = await getAppSession();
  if (session.kind === "active") {
    // Already in a practice — nothing to accept here.
    redirect("/app");
  }
  const sessionEmail =
    session.kind === "unauthenticated" ? null : session.user.email?.toLowerCase() ?? null;
  const emailMatches = !!invite && !!sessionEmail && sessionEmail === invite.email;

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
      <div className="opacity-40">
        <StarfieldBackground />
      </div>
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 20%, rgba(139,92,246,0.16) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-6 sm:px-10 py-6 border-b border-[var(--color-border-subtle)]">
          <Link
            href="/"
            aria-label="Fortify — home"
            className="font-mono text-[14px] font-bold tracking-[0.45em] text-[var(--color-primary)] uppercase hover:text-violet-300 transition-colors"
          >
            Fortify
          </Link>
        </header>

        <main className="flex-1 max-w-xl w-full mx-auto px-6 sm:px-8 py-16">
          {!invite ? (
            <Card>
              <CardBody className="text-center py-10">
                <h1 className="text-xl font-semibold mb-3">This invitation link isn&apos;t valid</h1>
                <p className="text-sm text-[var(--color-tertiary)] mb-8 leading-relaxed">
                  It may have expired, been revoked, or already been used. Ask your practice
                  administrator to send a fresh invitation.
                </p>
                <ButtonLink href="/" variant="secondary">
                  Back to Fortify
                </ButtonLink>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="py-10">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-quaternary)] mb-4 text-center">
                  Team invitation
                </p>
                <h1 className="text-2xl font-semibold mb-3 text-center">
                  Join {practiceName ?? "your practice"} on Fortify
                </h1>
                <p className="text-sm text-[var(--color-tertiary)] mb-8 leading-relaxed text-center">
                  You&apos;ve been invited as{" "}
                  <strong className="text-[var(--color-primary)]">
                    {ROLE_LABELS[invite.role]}
                  </strong>
                  . This invitation was sent to{" "}
                  <strong className="text-[var(--color-primary)]">{invite.email}</strong>.
                </p>

                {session.kind === "unauthenticated" ? (
                  <div className="flex flex-col items-center gap-4">
                    <ButtonLink href="/signup?account_type=employee">Create your account</ButtonLink>
                    <p className="text-xs text-[var(--color-quaternary)]">
                      Sign up with {invite.email} and you&apos;ll be connected automatically.
                      Already have an account?{" "}
                      <Link href="/login" className="text-violet-300 hover:underline">
                        Log in
                      </Link>
                    </p>
                  </div>
                ) : emailMatches ? (
                  <AcceptInviteButton token={token} />
                ) : (
                  <p className="text-sm text-amber-300/90 text-center leading-relaxed">
                    You&apos;re signed in as {sessionEmail}. To accept, log out and sign in with{" "}
                    {invite.email}.
                  </p>
                )}
              </CardBody>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
