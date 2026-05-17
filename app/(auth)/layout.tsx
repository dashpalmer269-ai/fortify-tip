import Link from "next/link";
import StarfieldBackground from "@/components/StarfieldBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <StarfieldBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="px-6 py-5 flex items-center">
          <Link
            href="/"
            className="text-lg font-bold tracking-[0.35em] text-white/80 uppercase"
            style={{ textShadow: "0 0 18px rgba(139,92,246,0.55)" }}
          >
            Fortify
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <div className="px-6 py-5 text-center text-xs text-gray-600">
          Compliance automation for healthcare ·{" "}
          <Link href="/security" className="hover:text-gray-400 transition-colors">
            our own posture
          </Link>
        </div>
      </div>
    </div>
  );
}
