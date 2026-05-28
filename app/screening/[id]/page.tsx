import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAppSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import StarfieldBackground from "@/components/StarfieldBackground";
import { Card, CardBody } from "@/components/ui/Card";
import VerifyForm from "./VerifyForm";
import { SCREENING_MESSAGES } from "@/lib/screening/user-message";

export const dynamic = "force-dynamic";

/**
 * Tier-2 verification page. Users land here from the onboarding submit when
 * preliminary screening produced review_required. The form posts to
 * /api/screening/[id]/verify; on success it routes to /pending (cleared)
 * or /screening/[id]/blocked (still flagged).
 */
export default async function ScreeningVerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAppSession();
  if (session.kind === "unauthenticated") redirect("/login");

  const db = createServerClient();
  if (!db) notFound();

  const { data: screening } = await db
    .from("exclusion_screenings")
    .select("id, subject_user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!screening) notFound();

  // Only the subject can use this page (admins use a separate review surface).
  if ("user" in session && screening.subject_user_id !== session.user.id) {
    notFound();
  }

  // Already decided — bounce to the right place.
  if (screening.status === "cleared" || screening.status === "overridden_clear") {
    redirect("/pending");
  }
  if (screening.status === "blocked") {
    redirect(`/screening/${id}/blocked`);
  }

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
      <div className="opacity-40"><StarfieldBackground /></div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
          <Link href="/" className="font-mono text-[14px] font-bold tracking-[0.45em] text-[var(--color-primary)] uppercase">
            Fortify
          </Link>
        </header>

        <main className="flex-1 max-w-xl w-full mx-auto px-6 sm:px-8 py-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-violet-300/80 mb-3">
            Quick verification
          </p>
          <h1 className="font-display text-[clamp(28px,3vw,40px)] text-[var(--color-primary)] leading-[1.1] mb-3" style={{ letterSpacing: "-0.02em" }}>
            {SCREENING_MESSAGES.reviewRequired}
          </h1>
          <p className="text-[15px] text-[var(--color-secondary)] leading-[1.7] mb-8">
            {SCREENING_MESSAGES.reviewExplanation}
          </p>

          <Card>
            <CardBody>
              <VerifyForm screeningId={id} />
            </CardBody>
          </Card>
        </main>
      </div>
    </div>
  );
}
