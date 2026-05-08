export default function ThreatLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="h-8 w-16 rounded-xl bg-white/[0.05] animate-pulse" />
          <div className="h-4 w-10 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="flex gap-3 mb-4">
            <div className="h-7 w-20 rounded-full bg-white/[0.08] animate-pulse" />
            <div className="h-7 w-28 rounded-full bg-white/[0.05] animate-pulse" />
          </div>
          <div className="h-8 w-full rounded bg-white/[0.08] animate-pulse mb-2" />
          <div className="h-8 w-2/3 rounded bg-white/[0.08] animate-pulse mb-3" />
          <div className="h-4 w-48 rounded bg-white/[0.04] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="h-4 w-24 rounded bg-white/[0.08] animate-pulse mb-4" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-white/[0.05] animate-pulse" />
                <div className="h-3 w-full rounded bg-white/[0.05] animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-white/[0.05] animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[0,1].map(i => (
                <div key={i} className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse mb-3" />
                  <div className="h-8 w-full rounded-xl bg-white/[0.05] animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse mb-4" />
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-white/[0.06] animate-pulse" />
                <div className="h-4 w-24 rounded bg-white/[0.05] animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
