/**
 * Headline backfill: rewrite every threat's `title` into a punchy newspaper headline using Opus 4.8.
 * Run with: npx tsx scripts/headlines.ts
 */
import Anthropic from "@anthropic-ai/sdk";
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

const PROMPT_HEADER = `You are a threat intelligence editor writing newspaper-style headlines for a cybersecurity briefing.

WRITE A HEADLINE
- 4 to 7 words, ideally 5
- Lead with the vendor/product or threat actor when known
- Active verbs: Exploited, Patched, Leaked, Hits, Targets, Breached, Discovered, Disclosed
- Plain English. Avoid jargon. Acronyms only if universally known (RCE, XSS, DDoS)
- NEVER start with "CVE-", "Vulnerability in", "The", or "A"
- Title Case. No trailing period. No quotes around the headline.

GOOD EXAMPLES
- Cisco IOS XE Bug Exploited
- WordPress Plugin Leaks 200K Sites
- LockBit Hits Healthcare Networks
- Chrome Zero-Day Under Active Attack
- Apache Struts RCE Disclosed
- T-Mobile Confirms 50M Record Breach

Output ONLY the headline text on a single line. No JSON, no explanation, no markdown.`;

async function generateHeadline(row: Row): Promise<string> {
  const context = [
    `Source: ${row.source_name ?? "unknown"} (${row.source_tab ?? "unknown"})`,
    row.cve_id ? `CVE: ${row.cve_id}` : null,
    row.severity ? `Severity: ${row.severity}` : null,
    row.affected_products?.length ? `Products: ${row.affected_products.slice(0, 5).join(", ")}` : null,
    `Original title: ${row.title}`,
    row.summary ? `Summary: ${row.summary.slice(0, 600)}` : null,
    row.raw_content ? `Raw: ${row.raw_content.slice(0, 800)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 60,
    messages: [{ role: "user", content: `${PROMPT_HEADER}\n\nTHREAT DATA\n${context}\n\nHEADLINE:` }],
  });

  const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  return clean(text);
}

function clean(raw: string): string {
  let h = (raw.trim().split("\n")[0] ?? "").trim();
  h = h.replace(/^["']|["']$/g, "");
  h = h.replace(/^HEADLINE:\s*/i, "");
  h = h.replace(/^CVE-\d{4}-\d+:\s*/i, "");
  h = h.replace(/\.$/, "");
  if (h.length > 90) h = h.slice(0, 87) + "…";
  return h;
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

  console.log(`Generating headlines for ${rows.length} rows with Opus 4.8...\n`);

  const updates = await processInBatches(rows as Row[], 5, async (row) => {
    try {
      const headline = await generateHeadline(row);
      return { id: row.id, headline, original: row.title };
    } catch (e) {
      console.error(`  ✗ ${row.id.slice(0, 8)} —`, (e as Error).message);
      return { id: row.id, headline: "", original: row.title };
    }
  });

  console.log("\nApplying updates...");
  let success = 0;
  let skipped = 0;
  for (const u of updates) {
    if (!u.headline) { skipped++; continue; }
    const { error: updErr } = await supabase.from("threats").update({ title: u.headline }).eq("id", u.id);
    if (updErr) {
      console.error(`  ✗ ${u.id.slice(0, 8)} —`, updErr.message);
    } else {
      success++;
      console.log(`  ✓ ${u.original.slice(0, 50)}...\n    → ${u.headline}`);
    }
  }

  console.log(`\nDone. Updated: ${success}, Skipped: ${skipped}, Total: ${updates.length}`);
}

main().catch(console.error);
