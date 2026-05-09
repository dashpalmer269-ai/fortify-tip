import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Threat } from "@/lib/types";

export const dynamic = "force-dynamic";

const SEVERITY_STYLES: Record<string, { color: string; glow: string; bg: string }> = {
  critical: { color: "#ef4444", glow: "rgba(239,68,68,0.5)", bg: "rgba(239,68,68,0.12)" },
  high:     { color: "#f97316", glow: "rgba(249,115,22,0.5)", bg: "rgba(249,115,22,0.12)" },
  medium:   { color: "#eab308", glow: "rgba(234,179,8,0.5)",  bg: "rgba(234,179,8,0.12)" },
  low:      { color: "#3b82f6", glow: "rgba(59,130,246,0.5)", bg: "rgba(59,130,246,0.12)" },
};

function readableTitle(threat: Threat): string {
  let title = threat.title ?? "";
  title = title.replace(/^CVE-\d{4}-\d{4,7}:\s*/i, "");
  title = title.replace(/^In the linux kernel,?\s+the following vulnerability has been (found|reported)[:\s]*/i, "Linux Kernel — ");
  title = title.replace(/^The (.+?) plugin for WordPress is vulnerable to (.+)/i, "WordPress Plugin: $1 — $2");
  title = title.trim();
  if (title.length > 0) title = title[0].toUpperCase() + title.slice(1);
  return title || threat.title;
}

export default async function ThreatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  if (!supabase) notFound();

  const { data } = await supabase.from("threats").select("*").eq("id", id).single();
  if (!data) notFound();
  const threat = data as Threat;

  const sev = SEVERITY_STYLES[threat.severity ?? "low"];
  const title = readableTitle(threat);

  const backHref =
    threat.source_tab === "registry" ? "/registry" :
    threat.source_tab === "community" ? "/community" : "/forums";

  const tabAccent =
    threat.source_tab === "registry"  ? { color: "#8B5CF6", glow: "rgba(139,92,246,0.3)" } :
    threat.source_tab === "community" ? { color: "#10B981", glow: "rgba(16,185,129,0.3)" } :
                                        { color: "#F97316", glow: "rgba(249,115,22,0.3)" };

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

  const publishedFormatted = threat.published_at
    ? new Date(threat.published_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
    : "Unknown date";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav bar */}
      <div
        className="border-b border-white/[0.06] px-6 py-4"
        style={{ background: `${tabAccent.glow.replace("0.3", "0.03")}` }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link
            href={backHref}
            className="glass-card rounded-xl px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Link>
          <Link href="/" className="text-gray-600 hover:text-gray-400 transition-colors text-sm">Home</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Severity + critical badge */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider"
            style={{ color: sev.color, background: sev.bg, boxShadow: `0 0 10px ${sev.glow}` }}
          >
            {threat.severity ?? "low"}
          </span>
          {threat.is_critical && (
            <span
              className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.15)", boxShadow: "0 0 10px rgba(239,68,68,0.5)" }}
            >
              ⚡ Critical
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-black text-white leading-tight tracking-tight mb-5">
          {title}
        </h1>

        {/* Metadata header row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 pb-6 border-b border-white/[0.06] mb-8">
          <span>
            <span className="text-gray-600 text-xs uppercase tracking-wider mr-1.5">Published</span>
            {publishedFormatted}
          </span>
          <span className="text-gray-700">·</span>
          <span>
            <span className="text-gray-600 text-xs uppercase tracking-wider mr-1.5">Source</span>
            <span style={{ color: tabAccent.color }}>{threat.source_name}</span>
          </span>
          {threat.cve_id && (
            <>
              <span className="text-gray-700">·</span>
              <span className="font-mono text-violet-400">{threat.cve_id}</span>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* What Happened */}
            {threat.summary && (
              <div
                className="glass-card rounded-2xl p-6"
                style={{ borderColor: tabAccent.glow, boxShadow: `0 0 20px ${tabAccent.glow.replace("0.3", "0.08")}` }}
              >
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">What Happened</p>
                <p className="text-gray-200 leading-relaxed text-[0.97rem]">{threat.summary}</p>
              </div>
            )}

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

            {/* References */}
            {threat.reference_url && (
              <div className="glass-card rounded-2xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">References</p>
                <a
                  href={threat.reference_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <div
                    className="mt-0.5 p-1.5 rounded-lg flex-shrink-0"
                    style={{ background: `${tabAccent.color}18` }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tabAccent.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">{threat.source_name}</p>
                    <p className="text-violet-400 text-sm group-hover:text-violet-300 transition-colors break-all">
                      {threat.reference_url}
                    </p>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Related */}
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

            {/* Metadata */}
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Details</p>
              <MetaRow label="Source" value={threat.source_name ?? "—"} />
              <MetaRow label="Section" value={threat.source_tab ?? "—"} />
              <MetaRow label="Ingested" value={threat.ingested_at ? new Date(threat.ingested_at).toLocaleDateString() : "—"} />
            </div>
          </div>
        </div>
      </div>
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
