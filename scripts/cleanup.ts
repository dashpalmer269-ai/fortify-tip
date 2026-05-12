/**
 * Cleanup script: removes junk NVD entries and true duplicates.
 * Run with: npx tsx scripts/cleanup.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import ws from "ws";

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
);

async function main() {
  // 1. Delete Linux kernel CVEs — all look identical when rendered
  const { data: linuxCves } = await supabase
    .from("threats")
    .select("id, title")
    .eq("source_tab", "registry")
    .ilike("raw_content", "In the Linux kernel%");

  if (linuxCves && linuxCves.length > 0) {
    const ids = linuxCves.map(r => r.id);
    const { error } = await supabase.from("threats").delete().in("id", ids);
    console.log(`Deleted ${ids.length} Linux kernel CVEs${error ? ` (error: ${error.message})` : ""}`);
  }

  // 2. Delete NVD entries where title is just a truncated CVE description (no real info)
  const { data: rawNvd } = await supabase
    .from("threats")
    .select("id, title, summary")
    .eq("source_name", "NVD/NIST")
    .eq("summary", "");  // No AI summary = raw unprocessed NVD noise

  if (rawNvd && rawNvd.length > 0) {
    const ids = rawNvd.map(r => r.id);
    const { error } = await supabase.from("threats").delete().in("id", ids);
    console.log(`Deleted ${ids.length} unsummarized NVD entries${error ? ` (error: ${error.message})` : ""}`);
  }

  // 3. Remove true duplicates across all tabs (keep earliest by ingested_at)
  const { data: all } = await supabase
    .from("threats")
    .select("id, title, reference_url, ingested_at")
    .order("ingested_at", { ascending: true });

  const seen = new Map<string, string>(); // key -> first id
  const toDelete: string[] = [];

  for (const row of all ?? []) {
    const key = row.reference_url || row.title.slice(0, 80);
    if (seen.has(key)) {
      toDelete.push(row.id);
    } else {
      seen.set(key, row.id);
    }
  }

  if (toDelete.length > 0) {
    // Delete in batches of 50
    for (let i = 0; i < toDelete.length; i += 50) {
      await supabase.from("threats").delete().in("id", toDelete.slice(i, i + 50));
    }
    console.log(`Deleted ${toDelete.length} true duplicates`);
  } else {
    console.log("No true duplicates found");
  }

  // Final count
  const { count } = await supabase.from("threats").select("*", { count: "exact", head: true });
  const { count: reg } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "registry");
  const { count: com } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "community");
  const { count: for_ } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "forums");
  console.log(`\nFinal DB state: ${count} total — Registry: ${reg}, Community: ${com}, Forums: ${for_}`);
}

main().catch(console.error);
