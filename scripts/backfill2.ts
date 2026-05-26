/**
 * Backfill top-up: regenerates community + forum articles with unique reference URLs.
 * Run with: npx tsx scripts/backfill2.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import ws from "ws";
import * as crypto from "crypto";

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

const uid = () => crypto.randomUUID();

function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(Math.floor(Math.random() * 22) + 1, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function pick<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("pick: empty array");
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ─── COMMUNITY ────────────────────────────────────────────────────────────────

const COMMUNITY_TOPICS = [
  { threat: "LockBit 4.0 ransomware targeting healthcare sector", actor: "LockBit", sev: "critical", daysAgo: 2 },
  { threat: "APT29 spear-phishing campaign against NATO member states", actor: "APT29", sev: "critical", daysAgo: 4 },
  { threat: "Scattered Spider SIM-swapping attacks on financial institutions", actor: "Scattered Spider", sev: "high", daysAgo: 6 },
  { threat: "BlackCat/ALPHV ransomware targeting energy infrastructure", actor: "ALPHV", sev: "critical", daysAgo: 7 },
  { threat: "Volt Typhoon pre-positioned in US critical infrastructure networks", actor: "Volt Typhoon", sev: "critical", daysAgo: 9 },
  { threat: "FIN7 deploying Clop ransomware via spear phishing campaigns", actor: "FIN7", sev: "high", daysAgo: 11 },
  { threat: "New Mirai botnet variant exploiting IoT devices at scale", actor: "Unknown", sev: "high", daysAgo: 13 },
  { threat: "Lazarus Group executing cryptocurrency exchange heist via social engineering", actor: "Lazarus Group", sev: "critical", daysAgo: 14 },
  { threat: "RedLine Stealer campaign targeting gaming and streaming accounts", actor: "Unknown", sev: "medium", daysAgo: 16 },
  { threat: "Emotet resurgence using malicious OneNote attachments as loader", actor: "TA542", sev: "high", daysAgo: 18 },
  { threat: "QBot banking trojan spreading through convincing PDF lures", actor: "TA570", sev: "high", daysAgo: 20 },
  { threat: "Storm-0558 forging authentication tokens to access cloud email", actor: "Storm-0558", sev: "critical", daysAgo: 22 },
  { threat: "IcedID loader distributing Cobalt Strike beacons across enterprise networks", actor: "TA577", sev: "high", daysAgo: 24 },
  { threat: "GhostLocker ransomware-as-a-service targeting legal and professional services", actor: "GhostSec", sev: "high", daysAgo: 26 },
  { threat: "Androxgh0st botnet mass-scanning Laravel applications for credentials", actor: "Unknown", sev: "medium", daysAgo: 28 },
];

// ─── FORUMS ───────────────────────────────────────────────────────────────────

const FORUM_TOPICS = [
  { outlet: "BleepingComputer", slug: "fbi-bec-scams-2025", headline: "FBI Warns of Surging Business Email Compromise Scams Draining Corporate Accounts", sev: "high", daysAgo: 1 },
  { outlet: "Krebs on Security", slug: "phishing-economy-credential-markets", headline: "Inside the Phishing Economy: How Underground Credential Markets Operate", sev: "high", daysAgo: 3 },
  { outlet: "Hacker News", slug: "arm-cpu-cache-timing-side-channel", headline: "Researchers Expose New Cache-Timing Side Channel Vulnerability in ARM CPUs", sev: "medium", daysAgo: 4 },
  { outlet: "BleepingComputer", slug: "change-healthcare-ransomware-100m", headline: "Change Healthcare Ransomware Attack Exposes Records of 100 Million Patients", sev: "critical", daysAgo: 5 },
  { outlet: "Krebs on Security", slug: "fake-ciso-liability-shields", headline: "The Fake CISO Problem: How Companies Use Hired Guns as Liability Shields", sev: "medium", daysAgo: 7 },
  { outlet: "Hacker News", slug: "ai-phishing-indistinguishable", headline: "AI-Generated Phishing Emails Now Indistinguishable From Legitimate Messages", sev: "high", daysAgo: 8 },
  { outlet: "BleepingComputer", slug: "cisa-kev-6-new-exploited-vulns", headline: "CISA Adds 6 Actively Exploited Vulnerabilities to Known Exploited Catalog", sev: "critical", daysAgo: 10 },
  { outlet: "Krebs on Security", slug: "sim-swappers-outwit-carriers", headline: "How SIM Swappers Consistently Outwit Mobile Carrier Security Controls", sev: "high", daysAgo: 11 },
  { outlet: "Hacker News", slug: "rowhammer-ddr5-vm-boundary", headline: "Rowhammer Attack Now Works Across Virtual Machine Boundaries on DDR5 RAM", sev: "high", daysAgo: 12 },
  { outlet: "BleepingComputer", slug: "ghostpulse-loader-windows-event-logs", headline: "New GhostPulse Loader Hides Malware Inside Windows Event Logs to Evade EDR", sev: "high", daysAgo: 14 },
  { outlet: "Krebs on Security", slug: "corporate-espionage-nation-state-tools", headline: "Inside a Corporate Espionage Operation: Nation-State Hacking Tools for Hire", sev: "critical", daysAgo: 15 },
  { outlet: "Hacker News", slug: "pypi-malicious-aws-credentials-40k", headline: "PyPI Malicious Package Silently Steals AWS Credentials — Downloaded 40,000 Times", sev: "critical", daysAgo: 17 },
  { outlet: "BleepingComputer", slug: "internet-archive-31m-breach", headline: "Internet Archive Breached: 31 Million User Records and Passwords Leaked", sev: "high", daysAgo: 18 },
  { outlet: "Krebs on Security", slug: "ransomware-data-extortion-no-encryption", headline: "Ransomware Groups Shifting Tactics: Data Extortion Without File Encryption", sev: "high", daysAgo: 20 },
  { outlet: "Hacker News", slug: "spectre-v2-linux-bypass-mitigations", headline: "New Spectre v2 Variant Bypasses All Current CPU Mitigations on Linux Kernels", sev: "high", daysAgo: 21 },
  { outlet: "BleepingComputer", slug: "volt-typhoon-5-year-dwell-time", headline: "Volt Typhoon Dwell Time in US Government Networks Exceeds Five Years", sev: "critical", daysAgo: 23 },
  { outlet: "Krebs on Security", slug: "infostealers-explosion-2025", headline: "The Quiet Explosion of Infostealers: How Credential Theft Became an Industry", sev: "high", daysAgo: 24 },
  { outlet: "Hacker News", slug: "regresshion-openssh-rce-14m", headline: "RegreSSHion: New OpenSSH RCE Vulnerability Affects 14 Million Internet-Facing Servers", sev: "critical", daysAgo: 25 },
  { outlet: "BleepingComputer", slug: "tmobile-50m-customer-breach", headline: "T-Mobile Confirms Data Breach: 50 Million Customer Records Compromised", sev: "critical", daysAgo: 27 },
  { outlet: "Krebs on Security", slug: "ransomware-leaked-builder-weaponization", headline: "How Ransomware Groups Weaponize Leaked Builder Source Code to Launch Attacks", sev: "high", daysAgo: 29 },
];

async function generateCommunity(topic: typeof COMMUNITY_TOPICS[0]) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 350,
    messages: [{
      role: "user",
      content: `Write a threat intelligence pulse for: "${topic.threat}" attributed to ${topic.actor}.
JSON only: { "title": "punchy title under 85 chars, no actor name prefix", "summary": "2-3 plain English sentences: what they're doing, who's at risk, what defenders should do", "tags": ["tag1","tag2","tag3","tag4"] }`
    }]
  });
  const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(text); } catch { /* use fallbacks */ }

  return {
    cve_id: null,
    title: p.title ?? topic.threat,
    summary: p.summary ?? "",
    affected_products: [],
    exploit_status: pick(["active", "active", "poc"]),
    reference_url: `https://otx.alienvault.com/pulse/${uid()}`,
    fix_status: "fixing",
    severity: topic.sev,
    source_name: "AlienVault OTX",
    source_tab: "community",
    raw_content: p.summary ?? topic.threat,
    credibility_score: pick([7, 8, 8, 9]),
    is_critical: topic.sev === "critical",
    tags: Array.isArray(p.tags) ? p.tags : [topic.actor],
    published_at: randomDate(topic.daysAgo),
  };
}

async function generateForum(topic: typeof FORUM_TOPICS[0]) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 350,
    messages: [{
      role: "user",
      content: `Write a security news summary for ${topic.outlet}: "${topic.headline}".
JSON only: { "summary": "2-3 sentences covering key findings, who is affected, and what defenders should know", "tags": ["tag1","tag2","tag3"] }`
    }]
  });
  const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(text); } catch { /* use fallbacks */ }

  const baseUrls: Record<string, string> = {
    "BleepingComputer": "https://www.bleepingcomputer.com/news/security",
    "Krebs on Security": "https://krebsonsecurity.com",
    "Hacker News": "https://news.ycombinator.com/item",
  };

  return {
    cve_id: null,
    title: topic.headline,
    summary: p.summary ?? "",
    affected_products: [],
    exploit_status: "none",
    reference_url: `${baseUrls[topic.outlet] ?? "https://news.ycombinator.com"}/${topic.slug}`,
    fix_status: "fixing",
    severity: topic.sev,
    source_name: topic.outlet,
    source_tab: "forums",
    raw_content: p.summary ?? topic.headline,
    credibility_score: pick([6, 7, 7, 8]),
    is_critical: topic.sev === "critical",
    tags: Array.isArray(p.tags) ? p.tags : [],
    published_at: randomDate(topic.daysAgo),
  };
}

async function main() {
  const items: Record<string, unknown>[] = [];

  console.log("Generating Community articles...");
  for (const topic of COMMUNITY_TOPICS) {
    try {
      const item = await generateCommunity(topic);
      items.push(item);
      process.stdout.write(`  ✓ ${String(item.title).slice(0, 60)}\n`);
    } catch (e) { console.error(`  ✗`, e); }
  }

  console.log("\nGenerating Forum articles...");
  for (const topic of FORUM_TOPICS) {
    try {
      const item = await generateForum(topic);
      items.push(item);
      process.stdout.write(`  ✓ ${String(item.title).slice(0, 60)}\n`);
    } catch (e) { console.error(`  ✗`, e); }
  }

  console.log(`\nInserting ${items.length} items...`);
  for (let i = 0; i < items.length; i += 20) {
    const { error } = await supabase.from("threats").insert(items.slice(i, i + 20));
    if (error) console.error("Insert error:", error.message);
  }

  const { count: reg } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "registry");
  const { count: com } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "community");
  const { count: for_ } = await supabase.from("threats").select("*", { count: "exact", head: true }).eq("source_tab", "forums");
  console.log(`\nDone. Registry: ${reg} | Community: ${com} | Forums: ${for_}`);
}

main().catch(console.error);
