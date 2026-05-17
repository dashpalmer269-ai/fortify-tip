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
            className="font-display text-xl italic text-[var(--color-primary)]"
            style={{ letterSpacing: "-0.01em" }}
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
