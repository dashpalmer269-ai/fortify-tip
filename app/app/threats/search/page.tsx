"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ThreatCard from "@/components/ThreatCard";
import { Threat } from "@/lib/types";

function SearchResults() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [results, setResults] = useState<Threat[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        setResults(data.results ?? []);
        setSynthesis(data.synthesis ?? null);
      })
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/app" className="glass-card rounded-xl px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-white">
            Search: <span className="text-violet-400">"{q}"</span>
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && synthesis && (
          <div
            className="glass-card rounded-2xl p-6 mb-8"
            style={{ borderColor: "rgba(139,92,246,0.3)", boxShadow: "0 0 20px rgba(139,92,246,0.1)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              <span className="text-sm font-semibold text-gray-300 tracking-wide uppercase">AI Synthesis</span>
            </div>
            <p className="text-gray-300 leading-relaxed">{synthesis}</p>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No results found for "{q}"</p>
            <p className="text-gray-600 text-sm mt-2">Try different keywords or check back after the next ingestion run.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-gray-500 text-sm mb-6">{results.length} results</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map(t => <ThreatCard key={t.id} threat={t} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /></div>}>
      <SearchResults />
    </Suspense>
  );
}
