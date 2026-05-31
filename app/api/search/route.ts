import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { searchThreats } from "@/lib/ai/processor";
import { Threat } from "@/lib/types";

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

function escapeLike(s: string): string {
  // PostgREST ILIKE — escape % and _ and remove commas (commas break .or() filter syntax)
  return s.replace(/[%_]/g, "\\$&").replace(/,/g, " ");
}

function fieldsOf(t: Threat): string[] {
  return [t.title, t.summary, t.raw_content].filter(Boolean).map((s) => (s as string).toLowerCase());
}

/**
 * Score a row against the query, prioritizing literal matches in this order:
 *   1) Exact phrase appears as-is
 *   2) All query words appear in the same order
 *   3) Number of query words present; closer together scores higher
 *
 * Scores are summed across tiers so a tier-1 match always outranks a tier-2-only match.
 */
function scoreRow(t: Threat, words: string[], phrase: string): number {
  const fields = fieldsOf(t);
  if (fields.length === 0) return 0;

  let phraseScore = 0;
  let orderedScore = 0;
  let wordCountScore = 0;
  let proximityScore = 0;

  for (const f of fields) {
    // Tier 1: exact phrase
    const phraseIdx = f.indexOf(phrase);
    if (phraseIdx !== -1) {
      // Earlier occurrences in the field score slightly higher
      const positional = 1 - phraseIdx / Math.max(f.length, 1);
      phraseScore = Math.max(phraseScore, 1 + positional * 0.2);
    }

    // Tier 2: all words present in order
    if (words.length > 1) {
      let cursor = 0;
      let allOrdered = true;
      let firstPos = -1;
      let lastPos = -1;
      for (const w of words) {
        const idx = f.indexOf(w, cursor);
        if (idx === -1) {
          allOrdered = false;
          break;
        }
        if (firstPos === -1) firstPos = idx;
        lastPos = idx + w.length;
        cursor = idx + w.length;
      }
      if (allOrdered) {
        const span = Math.max(lastPos - firstPos, 1);
        const totalChars = words.reduce((s, w) => s + w.length, 0);
        const tightness = totalChars / span;
        orderedScore = Math.max(orderedScore, 0.5 + tightness * 0.5);
      }
    }

    // Tier 3: word count + proximity (any order)
    const positions: number[] = [];
    for (const w of words) {
      const idx = f.indexOf(w);
      if (idx !== -1) positions.push(idx);
    }
    if (positions.length > 0) {
      wordCountScore = Math.max(wordCountScore, positions.length / words.length);
      if (positions.length > 1) {
        const span = Math.max(...positions) - Math.min(...positions);
        const prox = 1 / (1 + span / 60);
        proximityScore = Math.max(proximityScore, prox);
      } else {
        proximityScore = Math.max(proximityScore, 0.25);
      }
    }
  }

  // Weighted so each tier dominates the one below it
  return phraseScore * 10000 + orderedScore * 1000 + wordCountScore * 100 + proximityScore * 10;
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

  const phrase = q.toLowerCase();
  const words = phrase.split(/\s+/).filter((w) => w.length > 0);

  // ─── Tier A: literal candidate fetch ──────────────────────────────────────
  // First try the exact phrase; if it appears anywhere across our text fields,
  // we have strong matches and don't need broader expansion.
  const phraseEsc = escapeLike(phrase);
  const { data: phraseRows } = await supabase
    .from("threats")
    .select("*")
    .or(`title.ilike.%${phraseEsc}%,summary.ilike.%${phraseEsc}%,raw_content.ilike.%${phraseEsc}%`)
    .limit(50);

  const candidateMap = new Map<string, Threat>();
  for (const r of (phraseRows ?? []) as Threat[]) candidateMap.set(r.id, r);

  // ─── Tier B: fetch rows matching any individual word (only if needed) ───
  // We always pull these so we can rank lower-tier matches behind any phrase hits.
  if (words.length > 0) {
    const orFilter = words
      .flatMap((w) => {
        const e = escapeLike(w);
        return [`title.ilike.%${e}%`, `summary.ilike.%${e}%`, `raw_content.ilike.%${e}%`];
      })
      .join(",");

    const { data: anyWordRows } = await supabase
      .from("threats")
      .select("*")
      .or(orFilter)
      .limit(150);

    for (const r of (anyWordRows ?? []) as Threat[]) {
      if (!candidateMap.has(r.id)) candidateMap.set(r.id, r);
    }
  }

  // ─── Direct CVE id match (high-confidence shortcut) ──────────────────────
  if (/cve[-\s]?\d/i.test(q) || /^\d{4}-\d+$/.test(q)) {
    const { data: cveRows } = await supabase
      .from("threats")
      .select("*")
      .ilike("cve_id", `%${q}%`)
      .limit(10);
    for (const r of (cveRows ?? []) as Threat[]) {
      if (!candidateMap.has(r.id)) candidateMap.set(r.id, r);
    }
  }

  // ─── Score & rank literal matches ────────────────────────────────────────
  const literalRanked = Array.from(candidateMap.values())
    .map((row) => ({ row, score: scoreRow(row, words, phrase) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  let usedSemanticFallback = false;
  let finalResults: Threat[];

  if (literalRanked.length > 0) {
    finalResults = literalRanked.slice(0, 30).map((s) => s.row);
  } else {
    // ─── Tier C: semantic / FTS fallback — only when nothing matched literally
    usedSemanticFallback = true;
    try {
      const { data: ftsData } = await supabase.rpc("search_threats", { query: q }).limit(20);
      finalResults = (ftsData ?? []) as Threat[];
    } catch {
      finalResults = [];
    }
  }

  // ─── AI synthesis (only when we have results) ────────────────────────────
  let synthesis: string | null = null;
  if (finalResults.length > 0) {
    const context = finalResults
      .slice(0, 8)
      .map((t) => `- ${t.title} (${t.severity ?? "?"}, ${t.source_name}): ${t.summary ?? (t.raw_content ?? "").slice(0, 200)}`)
      .join("\n");
    try {
      synthesis = await searchThreats(q, context);
    } catch {
      synthesis = null;
    }
  }

  return NextResponse.json({
    results: finalResults,
    synthesis,
    total: finalResults.length,
    usedSemanticFallback,
  });
}
