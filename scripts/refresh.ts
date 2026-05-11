/**
 * Full refresh: regenerate every row through the canonical generateArticle pipeline.
 * Same strict validation/retry/re-verification as live ingestion — accuracy over speed.
 * Rows that fail the quality bar after retries are left untouched. Off-topic rows are deleted.
 * Run with: npx tsx scripts/refresh.ts
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

import { generateArticle } from "../lib/ai/processor";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
);

interface Row {
  id: string;
  title: string;
  summary: string | null;
  raw_content: string | null;
  source_name: string | null;
  source_tab: string | null;
  cve_id: string | null;
  affected_products: string[] | null;
  severity: string | null;
}

async function processInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(`  ${Math.min(i + batchSize, items.length)}/${items.length}\n`);
  }
  return results;
}

async function main() {
  const { data: rows, error } = await supabase
    .from("threats")
    .select("id, title, summary, raw_content, source_name, source_tab, cve_id, affected_products, severity");

  if (error || !rows) {
    console.error("Fetch failed:", error?.message);
    return;
  }

  console.log(`Regenerating ${rows.length} rows through generateArticle (3-4 word title, 333+ word body, 3-attempt retry)...\n`);

  const decisions = await processInBatches(rows as Row[], 4, async (row) => {
    try {
      // Use the existing summary as additional context if it's long enough to help.
      const richRaw = [row.raw_content, row.summary && row.summary.length > 80 ? row.summary : null]
        .filter(Boolean)
        .join("\n\n");

      const result = await generateArticle({
        title: row.title,
        raw_content: richRaw || row.title,
        source_name: row.source_name ?? "Unknown",
        source_tab: row.source_tab,
        cve_id: row.cve_id,
        severity: row.severity,
        affected_products: row.affected_products,
      });
      return { row, result, error: null as Error | null };
    } catch (e) {
      return { row, result: null, error: e as Error };
    }
  });

  const toDelete: string[] = [];
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  console.log("\nApplying decisions...\n");
  for (const d of decisions) {
    if (d.error) {
      errors++;
      console.log(`  ✗ ERROR   ${d.row.title.slice(0, 55)} — ${d.error.message}`);
      continue;
    }
    if (!d.result) {
      skipped++;
      console.log(`  ⊘ QUALITY ${d.row.title.slice(0, 55)} — failed quality bar after retries, leaving untouched`);
      continue;
    }
    if (!d.result.is_relevant) {
      toDelete.push(d.row.id);
      console.log(`  ✗ OFFTOP  ${d.row.title.slice(0, 55)}`);
      continue;
    }
    const { error: updErr } = await supabase
      .from("threats")
      .update({
        title: d.result.headline,
        summary: d.result.article_body,
        credibility_score: d.result.credibility_score,
        is_critical: d.result.is_critical,
        tags: d.result.tags,
      })
      .eq("id", d.row.id);
    if (updErr) {
      errors++;
      console.log(`  ✗ DB      ${d.row.title.slice(0, 55)} — ${updErr.message}`);
    } else {
      updated++;
      console.log(`  ✓ ${d.result.headline}  (${d.result.article_body.split(/\s+/).length} words)`);
    }
  }

  if (toDelete.length > 0) {
    console.log(`\nDeleting ${toDelete.length} off-topic rows...`);
    for (let i = 0; i < toDelete.length; i += 50) {
      const batch = toDelete.slice(i, i + 50);
      const { error: delErr } = await supabase.from("threats").delete().in("id", batch);
      if (delErr) console.error("Delete error:", delErr.message);
    }
  }

  const { count: total } = await supabase.from("threats").select("*", { count: "exact", head: true });
  const { count: reg } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "registry");
  const { count: com } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "community");
  const { count: forums } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "forums");

  console.log(`\nDone.`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Quality-bar skipped: ${skipped}`);
  console.log(`  Off-topic deleted: ${toDelete.length}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Final DB: ${total} total — registry=${reg}, community=${com}, forums=${forums}`);
}

main().catch(console.error);
