import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { searchThreats } from "@/lib/ai/processor";

// Simple in-memory rate limiter: 20 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], synthesis: null });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ results: [], synthesis: null });

  // Full-text search via the FTS index (with ilike fallback)
  let ftsResults: unknown[] | null = null;
  try {
    const { data } = await supabase.rpc("search_threats", { query: q }).limit(20);
    ftsResults = data;
  } catch {
    // RPC not yet created — fall through to ilike fallback
  }

  if (!ftsResults) {
    const { data } = await supabase
      .from("threats")
      .select("*")
      .or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
      .order("credibility_score", { ascending: false })
      .limit(20);
    ftsResults = data;
  }

  // Also match by exact CVE id pattern
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
