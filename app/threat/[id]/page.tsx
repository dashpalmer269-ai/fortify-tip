import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Threat } from "@/lib/types";

export const dynamic = 'force-dynamic';

const SEVERITY_STYLES: Record<string, { color: string; glow: string; bg: string }> = {
  critical: { color: "#ef4444", glow: "rgba(239,68,68,0.5)", bg: "rgba(239,68,68,0.12)" },
  high:     { color: "#f97316", glow: "rgba(249,115,22,0.5)", bg: "rgba(249,115,22,0.12)" },
  medium:   { color: "#eab308", glow: "rgba(234,179,8,0.5)",  bg: "rgba(234,179,8,0.12)" },
  low:      { color: "#3b82f6", glow: "rgba(59,130,246,0.5)", bg: "rgba(59,130,246,0.12)" },
};

const EXPLOIT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  active:      { label: "Actively Exploited", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  poc:         { label: "PoC Available",       color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  theoretical: { label: "Theoretical",         color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  none:        { label: "No Known Exploit",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

export default async function ThreatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase.from("threats").select("*").eq("id", id).single();

  if (!data) notFound();
  const threat = data as Threat;

  const sev = SEVERITY_STYLES[threat.severity ?? "low"];
  const exploit = EXPLOIT_STYLES[threat.exploit_status ?? "none"];

  const backHref = threat.source_tab === "registry"
    ? "/registry"
    : threat.source_tab === "community"
    ? "/community"
    : "/forums";

  const tabAccent =
    threat.source_tab === "registry"
      ? { color: "#8B5CF6", glow: "rgba(139,92,246,0.3)" }
      : threat.source_tab === "community"
      ? { color: "#10B981", glow: "rgba(16,185,129,0.3)" }
      : { color: "#F97316", glow: "rgba(249,115,22,0.3)" };

  // Fetch related threats by CVE or tags
  let related: Threat[] = [];
  if (threat.cve_id) {
    const { data: r } = await supabase
      .from("threats")
      .select("id, title, source_name, severity, source_tab")
      .eq("cve_id", threat.cve_id)
      .neq("id", threat.id)
      .limit(5);
    related = (r ?? []) as Threat[];
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div
        className="border-b border-white/[0.06] px-6 py-4"
        style={{ background: `${tabAccent.glow.replace("0.3","0.03")}` }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href={backHref}
            className="glass-card rounded-xl px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Link>
          <Link href="/" className="text-gray-600 hover:text-gray-400 transition-colors text-sm">Home</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Title section */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span
              className="text-sm font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider"
              style={{ color: sev.color, background: sev.bg, boxShadow: `0 0 12px ${sev.glow}` }}
            >
              {threat.severity ?? "low"}
            </span>
            {threat.is_critical && (
              <span
                className="text-sm font-bold px-3 py-1.5 rounded-full uppercase tracking-wider"
                style={{ color: "#ef4444", background: "rgba(239,68,68,0.15)", boxShadow: "0 0 12px rgba(239,68,68,0.5)" }}
              >
                ⚡ Critical Alert
              </span>
            )}
            {threat.cve_id && (
              <span className="font-mono text-sm text-violet-400 glass-card px-3 py-1.5 rounded-full">
                {threat.cve_id}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight">{threat.title}</h1>
          <p className="text-gray-500 text-sm mt-3">
            {threat.source_name} ·{" "}
            {threat.published_at
              ? new Date(threat.published_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
              : "Unknown date"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* AI Summary */}
            {threat.summary && (
              <div
                className="glass-card rounded-2xl p-6"
                style={{ borderColor: tabAccent.glow, boxShadow: `0 0 20px ${tabAccent.glow.replace("0.3","0.1")}` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: tabAccent.color }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-gray-300 tracking-wide uppercase">AI Summary</span>
                </div>
                <p className="text-gray-300 leading-relaxed">{threat.summary}</p>
              </div>
            )}

            {/* Exploit & Fix Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Exploit Status</p>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: exploit.bg }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: exploit.color, boxShadow: `0 0 8px ${exploit.color}` }} />
                  <span className="font-semibold text-sm" style={{ color: exploit.color }}>{exploit.label}</span>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Fix Status</p>
                <FixStatusDisplay fixStatus={threat.fix_status} />
              </div>
            </div>

            {/* Affected Products */}
            {threat.affected_products && threat.affected_products.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Affected Products</p>
                <div className="flex flex-wrap gap-2">
                  {threat.affected_products.map((p) => (
                    <span
                      key={p}
                      className="px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: "rgba(139,92,246,0.1)", color: "rgba(167,139,250,0.9)", border: "1px solid rgba(139,92,246,0.2)" }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {threat.tags && threat.tags.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {threat.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: "rgba(59,130,246,0.1)", color: "rgba(147,197,253,0.9)", border: "1px solid rgba(59,130,246,0.2)" }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reference Link */}
            {threat.reference_url && (
              <a
                href={threat.reference_url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card rounded-2xl p-5 flex items-center justify-between group transition-all duration-300 hover:border-violet-500/40"
              >
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Source Reference</p>
                  <p className="text-violet-400 text-sm group-hover:text-violet-300 break-all">{threat.reference_url}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" className="flex-shrink-0 ml-3">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Credibility */}
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Credibility Score</p>
              <CredibilityDisplay score={threat.credibility_score} />
            </div>

            {/* Related threats */}
            {related.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Also Confirmed By</p>
                <div className="space-y-2">
                  {related.map((r) => (
                    <Link key={r.id} href={`/threat/${r.id}`}>
                      <div className="p-3 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer">
                        <p className="text-xs text-gray-300 line-clamp-2">{r.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{r.source_name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Metadata</p>
              <MetaRow label="Source" value={threat.source_name ?? "—"} />
              <MetaRow label="Tab" value={threat.source_tab ?? "—"} />
              <MetaRow label="Ingested" value={threat.ingested_at ? new Date(threat.ingested_at).toLocaleDateString() : "—"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FixStatusDisplay({ fixStatus }: { fixStatus: string | null }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    patched:    { label: "Patched",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    workaround: { label: "Workaround", color: "#eab308", bg: "rgba(234,179,8,0.12)" },
    fixing:     { label: "Fixing…",   color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  };
  const s = map[fixStatus ?? "fixing"] ?? map.fixing;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: s.bg }}>
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
      <span className="font-semibold text-sm" style={{ color: s.color }}>{s.label}</span>
    </div>
  );
}

function CredibilityDisplay({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 8 ? "#10b981" : s >= 5 ? "#eab308" : "#ef4444";
  const label = s >= 8 ? "High" : s >= 5 ? "Medium" : "Low";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="40" cy="40" r="30"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${(s / 10) * 188.5} 188.5`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>{s}</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label} Credibility</span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-xs text-gray-400 capitalize">{value}</span>
    </div>
  );
}
