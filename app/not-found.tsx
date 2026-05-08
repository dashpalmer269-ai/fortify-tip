import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(139,92,246,0.08)", boxShadow: "0 0 30px rgba(139,92,246,0.2)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" /><line x1="11" y1="16" x2="11.01" y2="16" />
          </svg>
        </div>
        <p
          className="text-7xl font-black mb-4 tabular-nums"
          style={{ color: "rgba(139,92,246,0.4)", letterSpacing: "-0.04em" }}
        >
          404
        </p>
        <h2 className="text-2xl font-bold text-white mb-2">Threat not found</h2>
        <p className="text-gray-500 mb-8 text-sm">
          This record doesn't exist or may have been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:scale-105"
          style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", boxShadow: "0 0 15px rgba(139,92,246,0.2)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          Return home
        </Link>
      </div>
    </div>
  );
}
