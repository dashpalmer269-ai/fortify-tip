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
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
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

        // AI enrichment
        let enrichment = { summary: "", credibility_score: 5, is_critical: false, tags: [] as string[] };
        try {
          enrichment = await enrichThreat(item, existingCveSources);
        } catch (aiErr) {
          console.error("AI enrichment failed:", aiErr);
        }

        const { error } = await supabase.from("threats").insert({
          ...item,
          ...enrichment,
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
