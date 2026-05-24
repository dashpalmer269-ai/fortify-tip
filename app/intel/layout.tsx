import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import { getMarketingViewer } from "@/lib/auth/viewer";

export default async function IntelLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getMarketingViewer();

  return (
    <div className="relative min-h-screen bg-[#04031a] text-white overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 80% 5%, rgba(139,92,246,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 15% 100%, rgba(80,40,180,0.12) 0%, transparent 65%)",
        }}
      />
      <StarfieldBackground />

      <MarketingNav active="intel" viewer={viewer} />

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 border-t border-white/[0.06] mt-12">
        <div className="mx-auto max-w-7xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/45">
          <p className="font-mono uppercase tracking-[0.3em]">Fortify · Intel</p>
          <div className="flex items-center gap-6">
            {!viewer && (
              <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
            )}
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
