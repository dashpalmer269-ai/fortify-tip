import { createServerClient } from "@/lib/supabase/server";
import ThreatCard from "@/components/ThreatCard";
import TabHeader from "@/components/TabHeader";
import Link from "next/link";
import { Threat } from "@/lib/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 11;

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;

  const supabase = createServerClient();
  let items: Threat[] = [];

  if (supabase) {
    const { data } = await supabase
      .from("threats")
      .select("*")
      .eq("source_tab", "community")
      .order("published_at", { ascending: false })
      .range(offset, offset + PER_PAGE);
    items = (data ?? []) as Threat[];
  }

  const hasNext = items.length > PER_PAGE;
  const display = items.slice(0, PER_PAGE);

  return (
    <div className="min-h-screen bg-black text-white">
      <TabHeader title="Community" accentBg="rgba(16,185,129,0.03)" />

      <div className="max-w-3xl mx-auto px-6 py-8">
        {display.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {display.map((threat) => (
                <ThreatCard key={threat.id} threat={threat} accentColor="rgba(16,185,129,0.5)" />
              ))}
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
              {page > 1 ? (
                <Link
                  href={`?page=${page - 1}`}
                  className="glass-card px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Previous
                </Link>
              ) : (
                <div />
              )}
              <span className="text-xs text-gray-600">Page {page}</span>
              {hasNext ? (
                <Link
                  href={`?page=${page + 1}`}
                  className="glass-card px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </>
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
