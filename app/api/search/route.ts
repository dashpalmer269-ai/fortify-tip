import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { searchThreats } from "@/lib/ai/processor";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], synthesis: null });
  }

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ results: [], synthesis: null });

  // Full-text search via PostgreSQL
  const { data: ftsResults } = await supabase
    .from("threats")
    .select("*")
    .textSearch("title", q, { type: "websearch" })
    .order("credibility_score", { ascending: false })
    .limit(20);

  // Also search by CVE id
  const { data: cveResults } = await supabase
    .from("threats")
    .select("*")
    .ilike("cve_id", `%${q}%`)
    .limit(10);

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged = [...(ftsResults ?? []), ...(cveResults ?? [])].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // AI synthesis
  let synthesis: string | null = null;
  if (merged.length > 0) {
    const context = merged
      .slice(0, 8)
      .map((t) => `- ${t.title} (${t.severity}, ${t.source_name}): ${t.summary ?? t.raw_content?.slice(0, 200)}`)
      .join("\n");
    try {
      synthesis = await searchThreats(q, context);
    } catch {
      synthesis = null;
    }
  }

  return NextResponse.json({ results: merged, synthesis, total: merged.length });
}
