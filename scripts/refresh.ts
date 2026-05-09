/**
 * Full refresh: for every threat row, ask Opus 4.7 to:
 *   1) classify if it's actually a cybersecurity threat/incident worth keeping
 *   2) write a punchy newspaper headline
 *   3) write a clean plain-English summary
 * Off-topic rows are deleted. Run with: npx tsx scripts/refresh.ts
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
  reference_url: string | null;
}

interface AiResult {
  is_relevant: boolean;
  headline: string;
  summary: string;
}

const PROMPT_INTRO = `You are the editor of a cybersecurity threat intelligence platform. The platform ONLY publishes content about: data breaches, malware, ransomware, phishing campaigns, vulnerabilities (CVEs), exploits, hacking incidents, threat actors / APTs, leaked credentials, and active digital attacks.

It does NOT publish: general tech news, AI/ML commentary, vendor marketing posts, opinion pieces, productivity tutorials, programming articles, conference reviews, or any non-security content.

TASK
1. Decide if the article below is a real cybersecurity threat/incident worth keeping. Respond strictly true/false.
2. If relevant, write a punchy 4-7 word newspaper-style HEADLINE.
3. If relevant, write a clean 2-3 sentence SUMMARY in plain English (what happened, who's at risk, what to do). Conversational, no jargon-only sentences. Pretend you're explaining to a smart non-security friend.

HEADLINE RULES
- 4 to 7 words, ideally 5
- Lead with vendor/product/actor when known
- Active verbs: Exploited, Patched, Leaked, Hits, Targets, Breached, Discovered, Disclosed, Steals, Hijacks
- NEVER start with "CVE-", "A vulnerability", "The", or "New" alone
- Title Case. No trailing period. No quotes.

GOOD HEADLINE EXAMPLES
- Cisco IOS XE Bug Exploited
- WordPress Plugin Leaks 200K Sites
- LockBit Hits Healthcare Networks
- Chrome Zero-Day Under Active Attack
- T-Mobile Confirms 50M Record Breach

OUTPUT — STRICT JSON ONLY, no markdown, no commentary:
{
  "is_relevant": true | false,
  "headline": "...",
  "summary": "..."
}

If is_relevant is false, headline and summary should be empty strings.`;

function buildContext(row: Row): string {
  return [
    `Source: ${row.source_name ?? "unknown"} (section: ${row.source_tab ?? "unknown"})`,
    row.cve_id ? `CVE: ${row.cve_id}` : null,
    row.severity ? `Severity: ${row.severity}` : null,
    row.affected_products?.length ? `Products: ${row.affected_products.slice(0, 5).join(", ")}` : null,
    row.reference_url ? `URL: ${row.reference_url}` : null,
    `Current title: ${row.title}`,
    row.summary ? `Existing summary: ${row.summary.slice(0, 800)}` : null,
    row.raw_content ? `Raw content: ${row.raw_content.slice(0, 1500)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function classify(row: Row): Promise<AiResult> {
  const ctx = buildContext(row);
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 500,
    messages: [{ role: "user", content: `${PROMPT_INTRO}\n\nARTICLE\n${ctx}` }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as AiResult;
  return {
    is_relevant: Boolean(parsed.is_relevant),
    headline: cleanHeadline(parsed.headline ?? ""),
    summary: (parsed.summary ?? "").trim(),
  };
}

function cleanHeadline(raw: string): string {
  let h = raw.trim().replace(/^["']|["']$/g, "");
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
    .select("id, title, summary, raw_content, source_name, source_tab, cve_id, affected_products, severity, reference_url");

  if (error || !rows) {
    console.error("Fetch failed:", error?.message);
    return;
  }

  console.log(`Refreshing ${rows.length} rows with Opus 4.7 (classify + headline + summary)...\n`);

  const decisions = await processInBatches(rows as Row[], 5, async (row) => {
    try {
      const result = await classify(row);
      return { row, result, error: null as Error | null };
    } catch (e) {
      return { row, result: null as AiResult | null, error: e as Error };
    }
  });

  const toDelete: string[] = [];
  let updated = 0;
  let kept = 0;
  let errors = 0;

  console.log("\nApplying decisions...\n");
  for (const d of decisions) {
    if (d.error || !d.result) {
      errors++;
      console.log(`  ✗ ERROR  ${d.row.title.slice(0, 60)} — ${d.error?.message ?? "no result"}`);
      continue;
    }
    if (!d.result.is_relevant) {
      toDelete.push(d.row.id);
      console.log(`  ✗ OFFTOP ${d.row.title.slice(0, 60)}`);
      continue;
    }
    if (d.result.headline && d.result.summary) {
      const { error: updErr } = await supabase
        .from("threats")
        .update({ title: d.result.headline, summary: d.result.summary })
        .eq("id", d.row.id);
      if (updErr) {
        errors++;
        console.log(`  ✗ DB     ${d.row.title.slice(0, 60)} — ${updErr.message}`);
      } else {
        updated++;
        console.log(`  ✓ ${d.result.headline}`);
      }
    } else {
      kept++;
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
  console.log(`  Off-topic deleted: ${toDelete.length}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Final DB: ${total} total — registry=${reg}, community=${com}, forums=${forums}`);
}

main().catch(console.error);
