import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import ThreatCard from "@/components/ThreatCard";
import type { Threat } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PER_SECTION = 6;

const SECTIONS: Array<{
  key: "registry" | "community" | "forums";
  label: string;
  description: string;
  accent: string;
}> = [
  {
    key: "registry",
    label: "Registry",
    description: "Authoritative CVE feed — NVD / NIST and CISA KEV. Every newly-published vulnerability, AI-summarized.",
    accent: "#8b5cf6",
  },
  {
    key: "community",
    label: "Community",
    description: "AlienVault OTX pulses — threat-actor activity reported by the security community.",
    accent: "#10b981",
  },
  {
    key: "forums",
    label: "Forums",
    description: "Curated news from BleepingComputer, Krebs on Security, and Hacker News.",
    accent: "#f97316",
  },
];

export default async function IntelPage() {
  const supabase = createServerClient();
  const sections: Record<string, Threat[]> = { registry: [], community: [], forums: [] };
  let totalCount = 0;

  if (supabase) {
    const [reg, com, fr] = await Promise.all([
      supabase.from("threats").select("*").eq("source_tab", "registry").order("published_at", { ascending: false }).limit(PER_SECTION),
      supabase.from("threats").select("*").eq("source_tab", "community").order("published_at", { ascending: false }).limit(PER_SECTION),
      supabase.from("threats").select("*").eq("source_tab", "forums").order("published_at", { ascending: false }).limit(PER_SECTION),
    ]);
    sections.registry = (reg.data ?? []) as Threat[];
    sections.community = (com.data ?? []) as Threat[];
    sections.forums = (fr.data ?? []) as Threat[];

    const { count } = await supabase.from("threats").select("*", { count: "exact", head: true });
    totalCount = count ?? 0;
  }

  return (
    <div className="mx-auto max-w-6xl px-8">
      {/* Hero */}
      <section className="pt-12 pb-16 max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-violet-300/80 mb-5">
          Continuously ingested · {totalCount} briefings
        </p>
        <h1
          className="font-display text-[clamp(40px,5vw,68px)] text-white leading-[1.02] mb-5"
          style={{ letterSpacing: "-0.025em" }}
        >
          Threat intelligence,{" "}
          <span className="italic text-violet-200">briefed</span> for healthcare.
        </h1>
        <p className="text-[15px] text-white/65 leading-relaxed">
          CVEs, breach disclosures, and threat-actor activity from the most-trusted sources — automatically summarized into clean newsroom-style briefs and tagged for healthcare relevance.
        </p>
      </section>

      {/* Sections — stacked, with a soft accent strip per feed */}
      <div className="space-y-20 pb-16">
        {SECTIONS.map((s) => (
          <Section key={s.key} meta={s} items={sections[s.key]} />
        ))}
      </div>
    </div>
  );
}

function Section({
  meta,
  items,
}: {
  meta: typeof SECTIONS[number];
  items: Threat[];
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-6 mb-6 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: meta.accent, boxShadow: `0 0 10px ${meta.accent}` }}
            />
            <h2
              className="font-display text-3xl text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              {meta.label}
            </h2>
          </div>
          <p className="text-[14px] text-white/55 leading-relaxed max-w-2xl">
            {meta.description}
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40 whitespace-nowrap shrink-0">
          {items.length} of many
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] py-12 text-center text-sm text-white/40">
          No briefings in this feed yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((t) => (
            <ThreatCard key={t.id} threat={t} hrefPrefix="/intel" />
          ))}
        </div>
      )}
    </section>
  );
}
