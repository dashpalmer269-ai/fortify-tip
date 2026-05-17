import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

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
    { key: "registry",  label: "Registry",  desc: "Authoritative CVE feed — NVD / NIST + CISA KEV", href: "/app/threats/registry",  count: counts.registry },
    { key: "community", label: "Community", desc: "AlienVault OTX threat actor pulses",              href: "/app/threats/community", count: counts.community },
    { key: "forums",    label: "Forums",    desc: "BleepingComputer, Krebs, Hacker News",            href: "/app/threats/forums",    count: counts.forums },
  ];

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Continuously ingested"
        title="Threat intel"
        description="CVEs, breach disclosures, and threat-actor activity — AI-summarized into newsroom briefs and tagged for healthcare relevance."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px surface rounded-xl overflow-hidden">
        {sections.map((s) => (
          <Link key={s.key} href={s.href} className="block bg-[var(--color-canvas)] hover:bg-[var(--color-surface-raised)] transition-colors p-6">
            <p className="font-display text-3xl text-[var(--color-primary)] tabular-nums" style={{ letterSpacing: "-0.02em" }}>
              {s.count}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mt-3 mb-1">
              {s.label}
            </p>
            <p className="text-sm text-[var(--color-secondary)] leading-relaxed">{s.desc}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)] mt-4">Open →</p>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <div className="px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-[var(--color-secondary)]">Search across all feeds</p>
          <Link href="/app/threats/search?q=" className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors">
            Open search →
          </Link>
        </div>
      </Card>
    </div>
  );
}
