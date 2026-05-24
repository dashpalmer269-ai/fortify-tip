import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
          <div className="w-full max-w-md animate-fade-in">{children}</div>
        </div>
        <div className="px-8 py-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-quaternary)]">
          Compliance automation · healthcare
        </div>
      </div>
    </div>
  );
}
