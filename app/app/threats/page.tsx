import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ThreatIntelOverviewPage() {
  const supabase = createServerClient();
  let counts = { registry: 0, community: 0, forums: 0 };

  if (supabase) {
    const [reg, com, fr] = await Promise.all([
      supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "registry"),
      supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "community"),
      supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "forums"),
    ]);
    counts = {
      registry: reg.count ?? 0,
      community: com.count ?? 0,
      forums: fr.count ?? 0,
    };
  }

  const sections = [
    {
      key: "registry",
      label: "Registry",
      desc: "Authoritative CVE feed — NVD / NIST + CISA KEV",
      href: "/app/threats/registry",
      count: counts.registry,
      color: "#8b5cf6",
    },
    {
      key: "community",
      label: "Community",
      desc: "AlienVault OTX threat actor pulses",
      href: "/app/threats/community",
      count: counts.community,
      color: "#10b981",
    },
    {
      key: "forums",
      label: "Forums",
      desc: "Curated news — BleepingComputer, Krebs, Hacker News",
      href: "/app/threats/forums",
      count: counts.forums,
      color: "#f97316",
    },
  ];

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Threat intelligence</p>
        <h1 className="text-3xl font-bold text-white">Live security feeds</h1>
        <p className="text-gray-400 mt-2 max-w-2xl">
          Continuously ingested CVEs, breach disclosures, and threat actor activity — AI-summarized into newsroom-style briefs and tagged for healthcare relevance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className="glass-card rounded-2xl p-6 hover:bg-white/[0.02] transition-colors block"
            style={{ boxShadow: `0 0 18px ${s.color}1a` }}
          >
            <p className="text-2xl font-black text-white tabular-nums" style={{ color: s.color }}>
              {s.count}
            </p>
            <p className="text-sm uppercase tracking-wider text-gray-400 mt-3">{s.label}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href="/app/threats/search?q="
          className="inline-flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search across all feeds →
        </Link>
      </div>
    </div>
  );
}
