import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import StarfieldBackground from "@/components/StarfieldBackground";
import { Card, CardBody } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

  // If they've already been added to a practice, kick them into the dashboard.
  if (session.membership) redirect("/app");

  const supabase = await createAuthedServerClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, job_title, pending_practice_name, primary_address, account_type")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // If admin somehow lands here without finishing wizard, redirect.
  if (profile?.account_type !== "employee") redirect("/app/onboarding");

  const addr = (profile?.primary_address ?? {}) as Record<string, string>;
  const addrLine = [addr.street_1, addr.city, addr.region].filter(Boolean).join(", ");

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
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

      <div className="relative z-10 max-w-2xl mx-auto px-6 sm:px-8 py-14">
        {/* Status mark */}
        <div className="mb-8 flex justify-center">
          <div
            className="w-16 h-16 rounded-full bg-violet-500/15 border border-violet-400/40 flex items-center justify-center animate-pulse-soft"
            style={{ boxShadow: "0 0 28px rgba(139,92,246,0.35)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e9d5ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-violet-300/80 mb-3">
            Awaiting approval
          </p>
          <h1
            className="font-display text-[clamp(34px,4vw,52px)] text-[var(--color-primary)] leading-[1.02] mb-4"
            style={{ letterSpacing: "-0.025em" }}
          >
            You&apos;re in the queue.
          </h1>
          <p className="text-[15px] text-[var(--color-secondary)] leading-[1.7] max-w-md mx-auto">
            We&apos;ve sent your details to the admin at{" "}
            <span className="text-[var(--color-primary)] font-medium">
              {profile?.pending_practice_name ?? "your practice"}
            </span>
            . You&apos;ll get email + dashboard access the moment they approve you.
          </p>
        </div>

        <Card className="mb-6">
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-4">
              Submitted for verification
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-6 gap-y-3 text-sm">
              <Row label="Name" value={profile?.full_name} />
              <Row label="Role" value={profile?.job_title} />
              <Row label="Practice" value={profile?.pending_practice_name} />
              <Row label="Work address" value={addrLine || "—"} />
              <Row label="Email" value={session.user.email ?? "—"} />
            </dl>
          </CardBody>
        </Card>

        <Card className="mb-8">
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-4">
              While you wait
            </p>
            <ul className="space-y-3 text-sm text-[var(--color-secondary)]">
              <Step>Make sure your admin knows to check Fortify → Team for new requests.</Step>
              <Step>Watch your inbox for the confirmation email — it goes out automatically.</Step>
              <Step>If something looks wrong above, contact your admin directly.</Step>
            </ul>
          </CardBody>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <ButtonLink href="/" variant="secondary" size="md" className="min-w-[160px]">
            Return Home
          </ButtonLink>
          <Link
            href="/login"
            className="text-[13px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Sign out and switch accounts
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes pulse-soft {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        .animate-pulse-soft { animation: pulse-soft 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-quaternary)]">
        {label}
      </dt>
      <dd className="text-[var(--color-primary)]">{value || "—"}</dd>
    </>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400/70 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}
