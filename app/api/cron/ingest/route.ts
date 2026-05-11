import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enrichThreat } from "@/lib/ai/processor";
import { fetchNvdCves } from "@/lib/sources/nvd";
import { fetchCisaKev } from "@/lib/sources/cisa";
import { fetchOtxPulses } from "@/lib/sources/otx";
import { fetchHackerNews } from "@/lib/sources/hackernews";
import { fetchBleepingComputer } from "@/lib/sources/bleepingcomputer";
import { fetchKrebs } from "@/lib/sources/krebs";
import { RawThreatInput } from "@/lib/types";

export const maxDuration = 300;

const SOURCES: { name: string; fn: () => Promise<RawThreatInput[]> }[] = [
  { name: "NVD/NIST", fn: fetchNvdCves },
  { name: "CISA KEV", fn: fetchCisaKev },
  { name: "AlienVault OTX", fn: fetchOtxPulses },
  { name: "Hacker News", fn: fetchHackerNews },
  { name: "BleepingComputer", fn: fetchBleepingComputer },
  { name: "Krebs on Security", fn: fetchKrebs },
];

export async function GET(req: NextRequest) {
  // Vercel crons send: Authorization: Bearer <CRON_SECRET>
  // Manual calls send: ?secret=<CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = req.nextUrl.searchParams.get("secret");
  const secret = bearerSecret ?? querySecret;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const results: Record<string, { fetched: number; inserted: number; error?: string }> = {};

  for (const source of SOURCES) {
    const log = { fetched: 0, inserted: 0, error: undefined as string | undefined };

    try {
      const items = await source.fn();
      log.fetched = items.length;

      for (const item of items) {
        // Check for duplicate by reference_url or cve_id+source
        if (item.reference_url) {
          const { data: existing } = await supabase
            .from("threats")
            .select("id")
            .eq("reference_url", item.reference_url)
            .limit(1);
          if (existing && existing.length > 0) continue;
        }

        // Count existing sources for this CVE for credibility scoring
        let existingCveSources = 0;
        if (item.cve_id) {
          const { count } = await supabase
            .from("threats")
            .select("id", { count: "exact", head: true })
            .eq("cve_id", item.cve_id);
          existingCveSources = count ?? 0;
        }

        // AI enrichment with strict quality gates — returns null if 3-attempt retry fails
        let enrichment: Awaited<ReturnType<typeof enrichThreat>> = null;
        try {
          enrichment = await enrichThreat(item, existingCveSources);
        } catch (aiErr) {
          console.error("AI enrichment failed:", aiErr);
        }

        // Quality bar not met or off-topic — do NOT publish
        if (!enrichment || !enrichment.is_relevant) continue;

        // Store the AI-generated headline as title and 333+ word article as summary
        const { error } = await supabase.from("threats").insert({
          ...item,
          title: enrichment.headline,
          summary: enrichment.article_body,
          credibility_score: enrichment.credibility_score,
          is_critical: enrichment.is_critical,
          tags: enrichment.tags,
        });

        if (!error) log.inserted++;
      }
    } catch (err) {
      log.error = String(err);
      console.error(`Source ${source.name} failed:`, err);
    }

    results[source.name] = log;

    // Log to DB
    await supabase.from("ingestion_logs").insert({
      source: source.name,
      items_fetched: log.fetched,
      items_new: log.inserted,
      status: log.error ? "error" : "success",
      error_message: log.error ?? null,
    });
  }

  return NextResponse.json({ ok: true, results });
}
