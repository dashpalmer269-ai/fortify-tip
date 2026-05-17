import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Threat } from "@/lib/types";

export const dynamic = "force-dynamic";

const SEVERITY_STYLES: Record<string, { color: string; bg: string }> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  medium:   { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  low:      { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
};

const TAB_TONE: Record<string, string> = {
  registry:  "#8b5cf6",
  community: "#10b981",
  forums:    "#f97316",
};

export default async function PublicThreatDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  if (!supabase) notFound();

  const { data } = await supabase.from("threats").select("*").eq("id", id).single();
  if (!data) notFound();
  const t = data as Threat;
  const sev = SEVERITY_STYLES[t.severity ?? "low"];
  const tone = TAB_TONE[t.source_tab ?? "registry"] ?? "#8b5cf6";

  let related: Threat[] = [];
  if (t.cve_id) {
    const { data: r } = await supabase
      .from("threats")
      .select("id, title, source_name, severity, source_tab")
      .eq("cve_id", t.cve_id)
      .neq("id", t.id)
      .limit(4);
    related = (r ?? []) as Threat[];
  }

  const publishedFormatted = t.published_at
    ? new Date(t.published_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
    : "Unknown date";

  return (
    <div className="mx-auto max-w-3xl px-8 pt-10 pb-16">
      <Link
        href="/intel"
        className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 hover:text-white transition-colors"
      >
        ← All intel
      </Link>

      <article className="mt-8">
        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.25em] px-2 py-1 rounded-full"
            style={{ color: tone, background: `${tone}15` }}
          >
            {t.source_name}
          </span>
          {t.is_critical && (
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] px-2 py-1 rounded-full"
                  style={{ color: "#fecaca", background: "rgba(239,68,68,0.18)" }}>
              ⚡ Critical
            </span>
          )}
          {t.cve_id && (
            <span className="font-mono text-[11px] text-violet-300/80">{t.cve_id}</span>
          )}
        </div>

        {/* Headline */}
        <h1
          className="font-display text-4xl sm:text-5xl text-white leading-[1.05] mb-4"
          style={{ letterSpacing: "-0.025em" }}
        >
          {t.title}
        </h1>

        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50 pb-7 mb-8 border-b border-white/[0.06]">
          <span><span className="font-mono text-[10px] uppercase tracking-wider text-white/35 mr-2">Published</span>{publishedFormatted}</span>
          {t.severity && (
            <>
              <span className="text-white/25">·</span>
              <span
                className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ color: sev.color, background: sev.bg }}
              >
                {t.severity}
              </span>
            </>
          )}
        </div>

        {/* What happened */}
        {t.summary && (
          <section className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">
              What happened
            </p>
            <div className="text-[15px] text-white/85 leading-[1.75] whitespace-pre-wrap font-display" style={{ fontWeight: 400 }}>
              {t.summary}
            </div>
          </section>
        )}

        {/* Affected products */}
        {t.affected_products && t.affected_products.length > 0 && (
          <section className="mb-8 pb-8 border-b border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">Affected products</p>
            <div className="flex flex-wrap gap-2">
              {t.affected_products.map((p) => (
                <span key={p} className="text-xs px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-white/70">
                  {p}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        {t.tags && t.tags.length > 0 && (
          <section className="mb-8 pb-8 border-b border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">Tags</p>
            <div className="flex flex-wrap gap-2">
              {t.tags.map((tg) => (
                <span key={tg} className="text-xs px-2.5 py-1 rounded-md bg-violet-500/8 border border-violet-500/20 text-violet-200/80">
                  #{tg}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Reference */}
        {t.reference_url && (
          <section className="mb-10 pb-10 border-b border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">Source reference</p>
            <a
              href={t.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 hover:text-violet-200 transition-colors text-sm break-all underline underline-offset-4"
            >
              {t.reference_url} ↗
            </a>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">Also confirmed by</p>
            <ul className="space-y-2">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/intel/${r.id}`}
                    className="block text-sm text-white/70 hover:text-white transition-colors"
                  >
                    <span className="text-white/40 mr-2">→</span>
                    {r.title}
                    <span className="text-white/40 ml-2 text-xs">· {r.source_name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Conversion CTA */}
        <div
          className="rounded-2xl px-6 py-7 text-center"
          style={{
            background: "radial-gradient(ellipse at center, rgba(139,92,246,0.14) 0%, transparent 80%)",
            border: "1px solid rgba(139,92,246,0.18)",
          }}
        >
          <p className="font-display text-xl text-white mb-2" style={{ letterSpacing: "-0.015em" }}>
            See how Fortify maps this threat to your compliance posture.
          </p>
          <p className="text-sm text-white/55 mb-5">
            14-day free trial · no credit card · HIPAA, SOC 2, ISO 27001, GDPR
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center h-11 px-5 text-sm font-medium rounded-lg bg-violet-500 hover:bg-violet-400 text-white transition-colors shadow-[0_0_24px_rgba(139,92,246,0.45)]"
          >
            Begin trial →
          </Link>
        </div>
      </article>
    </div>
  );
}
