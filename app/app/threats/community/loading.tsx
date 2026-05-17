export default function CommunityLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/[0.06] px-6 py-5" style={{ background: "rgba(16,185,129,0.03)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] animate-pulse" />
            <div className="w-8 h-8 rounded-xl animate-pulse" style={{ background: "rgba(16,185,129,0.12)" }} />
            <div>
              <div className="h-5 w-24 rounded bg-white/[0.08] animate-pulse" />
              <div className="h-3 w-40 rounded bg-white/[0.04] animate-pulse mt-1.5" />
            </div>
          </div>
          <div className="h-4 w-16 rounded bg-white/[0.05] animate-pulse" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="h-6 w-16 rounded-full animate-pulse mb-3" style={{ background: "rgba(16,185,129,0.12)" }} />
              <div className="h-4 w-full rounded bg-white/[0.06] animate-pulse mb-2" />
              <div className="h-4 w-3/4 rounded bg-white/[0.06] animate-pulse mb-4" />
              <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse mb-1.5" />
              <div className="h-3 w-5/6 rounded bg-white/[0.04] animate-pulse mb-4" />
              <div className="flex gap-2">
                <div className="h-3 w-20 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
