import { createServerClient } from "@/lib/supabase/server";
import ThreatCard from "@/components/ThreatCard";
import Link from "next/link";
import { Threat } from "@/lib/types";

export const dynamic = 'force-dynamic';

export default async function CommunityPage() {
  const supabase = createServerClient();
  const items: Threat[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("threats")
      .select("*")
      .eq("source_tab", "community")
      .order("published_at", { ascending: false })
      .limit(50);
    items.push(...((data ?? []) as Threat[]));
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div
        className="border-b border-white/[0.06] px-6 py-5"
        style={{ background: "rgba(16,185,129,0.03)" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="glass-card rounded-xl p-2 text-white/60 hover:text-white transition-colors mr-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <div
              className="p-2.5 rounded-xl"
              style={{ background: "rgba(16,185,129,0.12)", boxShadow: "0 0 15px rgba(16,185,129,0.3)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide text-white">Community</h1>
              <p className="text-xs text-gray-500 mt-0.5">AlienVault OTX · Crowdsourced Intel</p>
            </div>
          </div>
          <span className="text-sm text-gray-500">{items.length} threats</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((threat) => (
              <ThreatCard key={threat.id} threat={threat} accentColor="rgba(16,185,129,0.5)" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: "rgba(16,185,129,0.08)", boxShadow: "0 0 30px rgba(16,185,129,0.2)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <p className="text-gray-400 text-lg font-medium">No community threats yet</p>
      <p className="text-gray-600 text-sm mt-2">Data ingestion runs at 06:00 and 18:00 UTC</p>
    </div>
  );
}
