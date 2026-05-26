import Link from "next/link";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import StarfieldBackground from "@/components/StarfieldBackground";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function OnboardingWelcomePage() {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const { data: practice } = await supabase
    .from("practices")
    .select("name, selected_plan")
    .eq("id", session.membership.practice_id)
    .single();

  const practiceName = practice?.name ?? "your practice";

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-primary)] overflow-hidden">
      <div className="opacity-70">
        <StarfieldBackground />
      </div>

      {/* Layered radial glows */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(139,92,246,0.30) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 50% 70%, rgba(99,102,241,0.18) 0%, transparent 60%)",
        }}
      />

      {/* Confetti bursts (pure CSS pseudo-particles) */}
      <Confetti />

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

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-2xl text-center">
            {/* Animated pulse mark */}
            <div className="relative mx-auto mb-10 w-28 h-28 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full animate-pulse-glow"
                style={{
                  background:
                    "radial-gradient(circle, rgba(139,92,246,0.45) 0%, transparent 70%)",
                }}
              />
              <div
                className="absolute inset-4 rounded-full border border-violet-400/40 animate-pulse-ring"
              />
              <div
                className="relative w-16 h-16 rounded-full bg-violet-500/25 border border-violet-300/70 flex items-center justify-center animate-check-pop"
                style={{ boxShadow: "0 0 48px rgba(139,92,246,0.7)" }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f5f3ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-violet-300 mb-5 animate-fade-up">
              You&apos;re fortified
            </p>
            <h1
              className="font-display text-[clamp(44px,6vw,76px)] text-[var(--color-primary)] leading-[0.98] mb-6 animate-fade-up"
              style={{ letterSpacing: "-0.035em", animationDelay: "100ms" }}
            >
              Welcome to <span className="italic text-violet-200">Fortify.</span>
            </h1>
            <p
              className="text-[16px] text-[var(--color-secondary)] leading-[1.7] max-w-xl mx-auto mb-10 animate-fade-up"
              style={{ animationDelay: "200ms" }}
            >
              <span className="text-[var(--color-primary)] font-medium">{practiceName}</span> is officially live.
              Your control library is loaded, your dashboard is built, and audit-log tracking
              starts now.
            </p>

            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-up"
              style={{ animationDelay: "300ms" }}
            >
              <ButtonLink href="/" variant="secondary" size="lg" className="min-w-[180px]">
                Return Home
              </ButtonLink>
              <ButtonLink href="/app" variant="primary" size="lg" className="min-w-[180px]">
                View Dashboard →
              </ButtonLink>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes check-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-check-pop { animation: check-pop 700ms cubic-bezier(.34,1.56,.64,1) both; }
        .animate-pulse-glow { animation: pulse-glow 2.4s ease-in-out infinite; }
        .animate-pulse-ring { animation: pulse-ring 2.4s ease-out infinite; }
        .animate-fade-up { animation: fade-up 700ms ease both; }
      `}</style>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 24 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {pieces.map((_, i) => {
        const left = (i * 4.17) % 100;
        const delay = (i % 8) * 120;
        const duration = 3200 + (i % 5) * 400;
        const colors = ["#a78bfa", "#c4b5fd", "#818cf8", "#e9d5ff", "#7c3aed"];
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute top-[-8px] block w-1.5 h-3 rounded-sm opacity-80"
            style={{
              left: `${left}%`,
              background: color,
              animation: `confetti-fall ${duration}ms ${delay}ms ease-in both`,
              boxShadow: `0 0 6px ${color}80`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0); opacity: 0; }
          15% { opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
