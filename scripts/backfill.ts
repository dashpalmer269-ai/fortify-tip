/**
 * Backfill script: generates ~30 days of threat intel articles per tab
 * using Claude to produce realistic, varied content, then inserts into Supabase.
 * Run with: npx tsx scripts/backfill.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}
dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
import ws from "ws";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
);

function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── REGISTRY PROMPTS ────────────────────────────────────────────────────────

const REGISTRY_TOPICS = [
  // Week 1 (days 1-7)
  { cveYear: "2025", vendor: "Microsoft", product: "Windows LDAP", vector: "Remote Code Execution", severity: "critical", daysAgo: 2 },
  { cveYear: "2025", vendor: "Cisco", product: "IOS XE Web UI", vector: "Authentication Bypass", severity: "critical", daysAgo: 3 },
  { cveYear: "2025", vendor: "Ivanti", product: "Connect Secure VPN", vector: "Stack Buffer Overflow", severity: "critical", daysAgo: 4 },
  { cveYear: "2025", vendor: "Fortinet", product: "FortiGate SSL-VPN", vector: "Out-of-Bounds Write", severity: "high", daysAgo: 5 },
  { cveYear: "2025", vendor: "Apache", product: "Tomcat", vector: "Partial PUT Request Smuggling", severity: "high", daysAgo: 6 },
  { cveYear: "2025", vendor: "VMware", product: "vCenter Server", vector: "Heap Overflow", severity: "critical", daysAgo: 7 },
  // Week 2 (days 8-14)
  { cveYear: "2025", vendor: "Google", product: "Chrome V8 Engine", vector: "Type Confusion", severity: "high", daysAgo: 8 },
  { cveYear: "2025", vendor: "Palo Alto", product: "PAN-OS GlobalProtect", vector: "Command Injection", severity: "critical", daysAgo: 9 },
  { cveYear: "2025", vendor: "SolarWinds", product: "Web Help Desk", vector: "Hardcoded Credential", severity: "critical", daysAgo: 10 },
  { cveYear: "2025", vendor: "OpenSSH", product: "sshd", vector: "Signal Handler Race Condition", severity: "critical", daysAgo: 11 },
  { cveYear: "2025", vendor: "GitLab", product: "CE/EE", vector: "SSRF via Import Feature", severity: "high", daysAgo: 12 },
  { cveYear: "2025", vendor: "WordPress", product: "Core XML-RPC", vector: "Brute Force Amplification", severity: "medium", daysAgo: 13 },
  { cveYear: "2025", vendor: "Atlassian", product: "Confluence Data Center", vector: "Privilege Escalation", severity: "critical", daysAgo: 14 },
  // Week 3 (days 15-21)
  { cveYear: "2025", vendor: "Mozilla", product: "Firefox", vector: "Use-After-Free in Animation", severity: "high", daysAgo: 15 },
  { cveYear: "2025", vendor: "Juniper", product: "Junos OS", vector: "J-Web RCE", severity: "critical", daysAgo: 16 },
  { cveYear: "2025", vendor: "SAP", product: "NetWeaver ABAP", vector: "Directory Traversal", severity: "high", daysAgo: 17 },
  { cveYear: "2025", vendor: "Exim", product: "Mail Transfer Agent", vector: "SMTP Smuggling", severity: "high", daysAgo: 18 },
  { cveYear: "2025", vendor: "Linux", product: "Kernel io_uring", vector: "Privilege Escalation", severity: "high", daysAgo: 19 },
  { cveYear: "2025", vendor: "Zimbra", product: "Collaboration Suite", vector: "XSS to RCE Chain", severity: "critical", daysAgo: 20 },
  { cveYear: "2025", vendor: "Zyxel", product: "NAS Firmware", vector: "OS Command Injection", severity: "critical", daysAgo: 21 },
  // Week 4 (days 22-30)
  { cveYear: "2025", vendor: "Oracle", product: "WebLogic Server", vector: "Deserialization RCE", severity: "critical", daysAgo: 22 },
  { cveYear: "2025", vendor: "Jenkins", product: "CI/CD Server", vector: "Arbitrary File Read", severity: "high", daysAgo: 23 },
  { cveYear: "2025", vendor: "Spring", product: "Framework", vector: "SpEL Injection", severity: "high", daysAgo: 24 },
  { cveYear: "2025", vendor: "D-Link", product: "Router Firmware", vector: "Pre-Auth RCE", severity: "critical", daysAgo: 25 },
  { cveYear: "2025", vendor: "Redis", product: "Redis Server", vector: "Lua Sandbox Escape", severity: "high", daysAgo: 26 },
  { cveYear: "2025", vendor: "Apple", product: "iOS/macOS WebKit", vector: "Memory Corruption", severity: "critical", daysAgo: 27 },
  { cveYear: "2025", vendor: "NVIDIA", product: "CUDA Toolkit", vector: "Out-of-Bounds Memory Access", severity: "high", daysAgo: 28 },
  { cveYear: "2025", vendor: "Progress", product: "MOVEit Transfer", vector: "SQL Injection", severity: "critical", daysAgo: 29 },
  { cveYear: "2025", vendor: "F5", product: "BIG-IP TMUI", vector: "Authentication Bypass", severity: "critical", daysAgo: 30 },
];

const COMMUNITY_TOPICS = [
  { threat: "LockBit 4.0 ransomware targeting healthcare", actor: "LockBit", daysAgo: 2 },
  { threat: "APT29 (Cozy Bear) phishing campaign against NATO", actor: "APT29", daysAgo: 4 },
  { threat: "Scattered Spider SIM-swapping financial sector", actor: "Scattered Spider", daysAgo: 6 },
  { threat: "BlackCat/ALPHV attack on energy infrastructure", actor: "ALPHV", daysAgo: 7 },
  { threat: "Volt Typhoon pre-positioned in US critical infrastructure", actor: "Volt Typhoon", daysAgo: 9 },
  { threat: "FIN7 deploying Clop ransomware via spear phishing", actor: "FIN7", daysAgo: 11 },
  { threat: "New Mirai botnet variant targeting IoT devices", actor: "Unknown", daysAgo: 13 },
  { threat: "Lazarus Group cryptocurrency exchange heist", actor: "Lazarus Group", daysAgo: 14 },
  { threat: "RedLine Stealer campaign targeting gaming accounts", actor: "Unknown", daysAgo: 16 },
  { threat: "Emotet resurgence via OneNote malicious attachments", actor: "TA542", daysAgo: 18 },
  { threat: "QBot banking trojan spread through PDF lures", actor: "TA570", daysAgo: 20 },
  { threat: "Storm-0558 forged authentication tokens targeting cloud", actor: "Storm-0558", daysAgo: 22 },
  { threat: "IcedID loader distributing Cobalt Strike beacons", actor: "TA577", daysAgo: 24 },
  { threat: "GhostLocker RaaS new affiliate targeting legal sector", actor: "GhostSec", daysAgo: 26 },
  { threat: "Androxgh0st botnet mass-scanning Laravel apps", actor: "Unknown", daysAgo: 28 },
];

const FORUM_TOPICS = [
  { outlet: "BleepingComputer", headline: "FBI warns of surging BEC scams draining business accounts", daysAgo: 1 },
  { outlet: "Krebs on Security", headline: "Inside the Phishing Economy: How Credential Markets Operate", daysAgo: 3 },
  { outlet: "Hacker News", headline: "Researchers expose new cache-timing side channel in ARM CPUs", daysAgo: 4 },
  { outlet: "BleepingComputer", headline: "Change Healthcare ransomware attack affects 100M patients", daysAgo: 5 },
  { outlet: "Krebs on Security", headline: "The Fake CISO Problem: Hired Guns and Liability Shields", daysAgo: 7 },
  { outlet: "Hacker News", headline: "AI-generated phishing emails now indistinguishable from real ones", daysAgo: 8 },
  { outlet: "BleepingComputer", headline: "CISA adds 6 known exploited vulnerabilities to KEV catalog", daysAgo: 10 },
  { outlet: "Krebs on Security", headline: "How SIM Swappers Outwit Mobile Carriers", daysAgo: 11 },
  { outlet: "Hacker News", headline: "Rowhammer attack now works across VM boundaries on DDR5", daysAgo: 12 },
  { outlet: "BleepingComputer", headline: "New 'GhostPulse' loader evades EDR using Windows event logs", daysAgo: 14 },
  { outlet: "Krebs on Security", headline: "Inside a Corporate Espionage Operation: Nation-State Tools for Hire", daysAgo: 15 },
  { outlet: "Hacker News", headline: "PyPI malicious package steals AWS credentials, 40k downloads", daysAgo: 17 },
  { outlet: "BleepingComputer", headline: "Internet Archive breached, 31 million user records leaked", daysAgo: 18 },
  { outlet: "Krebs on Security", headline: "Ransomware Groups Shifting to Data Extortion Without Encryption", daysAgo: 20 },
  { outlet: "Hacker News", headline: "New Spectre v2 variant bypasses all current mitigations on Linux", daysAgo: 21 },
  { outlet: "BleepingComputer", headline: "Volt Typhoon dwell time in US networks exceeds 5 years", daysAgo: 23 },
  { outlet: "Krebs on Security", headline: "The Quiet Explosion of Infostealers in 2025", daysAgo: 24 },
  { outlet: "Hacker News", headline: "RegreSSHion: New OpenSSH RCE affects 14M internet-facing servers", daysAgo: 25 },
  { outlet: "BleepingComputer", headline: "T-Mobile confirms data breach, 50M customer records exposed", daysAgo: 27 },
  { outlet: "Krebs on Security", headline: "How Ransomware Groups Weaponize Leaked Builder Source Code", daysAgo: 29 },
];

// ─── AI GENERATION ────────────────────────────────────────────────────────────

async function generateRegistry(topic: typeof REGISTRY_TOPICS[0]): Promise<Record<string, unknown>> {
  const cveNum = Math.floor(10000 + Math.random() * 89999);
  const cveId = `CVE-${topic.cveYear}-${cveNum}`;
  const credibility = pickRandom([7, 8, 8, 9, 9, 10]);
  const exploitStatus = topic.severity === "critical" ? pickRandom(["active", "poc"]) : pickRandom(["poc", "none"]);
  const isExploit = exploitStatus === "active";

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Write a realistic threat intelligence entry for ${cveId} affecting ${topic.vendor} ${topic.product} via ${topic.vector}.
Respond in JSON only (no markdown):
{
  "title": "short title under 100 chars",
  "summary": "2-3 sentence plain-English summary of the vulnerability, impact, and remediation",
  "tags": ["tag1","tag2","tag3","tag4"],
  "affected_products": ["product string"]
}`
    }]
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  return {
    cve_id: cveId,
    title: parsed.title ?? `${cveId}: ${topic.vendor} ${topic.product} ${topic.vector}`,
    summary: parsed.summary ?? "",
    affected_products: parsed.affected_products ?? [`${topic.vendor} ${topic.product}`],
    exploit_status: exploitStatus,
    reference_url: `https://nvd.nist.gov/vuln/detail/${cveId}`,
    fix_status: isExploit ? "workaround" : "patched",
    severity: topic.severity,
    source_name: pickRandom(["NVD/NIST", "CISA KEV"]),
    source_tab: "registry",
    raw_content: parsed.summary ?? "",
    credibility_score: credibility,
    is_critical: isExploit && (topic.severity === "critical"),
    tags: parsed.tags ?? [topic.vendor, topic.vector],
    published_at: randomDate(topic.daysAgo),
  };
}

async function generateCommunity(topic: typeof COMMUNITY_TOPICS[0]): Promise<Record<string, unknown>> {
  const credibility = pickRandom([6, 7, 7, 8, 8, 9]);

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Write a threat intelligence pulse for this community-sourced threat: "${topic.threat}" attributed to ${topic.actor}.
Respond in JSON only (no markdown):
{
  "title": "short punchy title under 90 chars",
  "summary": "2-3 sentences describing the threat, TTPs, and recommended defenses",
  "tags": ["tag1","tag2","tag3","tag4"],
  "affected_products": ["industry or platform targeted"]
}`
    }]
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  const isActive = pickRandom([true, true, false]);

  return {
    cve_id: null,
    title: parsed.title ?? topic.threat,
    summary: parsed.summary ?? "",
    affected_products: parsed.affected_products ?? [],
    exploit_status: isActive ? "active" : "poc",
    reference_url: `https://otx.alienvault.com/browse/global/pulses`,
    fix_status: "fixing",
    severity: pickRandom(["critical", "critical", "high", "high", "medium"]),
    source_name: "AlienVault OTX",
    source_tab: "community",
    raw_content: parsed.summary ?? "",
    credibility_score: credibility,
    is_critical: isActive,
    tags: parsed.tags ?? [topic.actor],
    published_at: randomDate(topic.daysAgo),
  };
}

async function generateForum(topic: typeof FORUM_TOPICS[0]): Promise<Record<string, unknown>> {
  const credibility = pickRandom([5, 6, 6, 7, 7, 8]);

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Write a security news article summary for ${topic.outlet}: "${topic.headline}".
Respond in JSON only (no markdown):
{
  "title": "${topic.headline}",
  "summary": "2-3 sentence summary of the article content, key findings, and implications for defenders",
  "tags": ["tag1","tag2","tag3"],
  "severity": "critical|high|medium|low"
}`
    }]
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  const refMap: Record<string, string> = {
    "BleepingComputer": "https://www.bleepingcomputer.com",
    "Krebs on Security": "https://krebsonsecurity.com",
    "Hacker News": "https://news.ycombinator.com",
  };

  return {
    cve_id: null,
    title: topic.headline,
    summary: parsed.summary ?? "",
    affected_products: [],
    exploit_status: "none",
    reference_url: refMap[topic.outlet] ?? "https://news.ycombinator.com",
    fix_status: "fixing",
    severity: (parsed.severity as string) ?? "medium",
    source_name: topic.outlet,
    source_tab: "forums",
    raw_content: parsed.summary ?? "",
    credibility_score: credibility,
    is_critical: false,
    tags: parsed.tags ?? [],
    published_at: randomDate(topic.daysAgo),
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting backfill — generating 30 days of threat intel...\n");

  const allItems: Record<string, unknown>[] = [];

  console.log("Generating Registry (CVE/KEV) articles...");
  for (const topic of REGISTRY_TOPICS) {
    try {
      const item = await generateRegistry(topic);
      allItems.push(item);
      process.stdout.write(`  ✓ ${item.cve_id}\n`);
    } catch (e) { console.error(`  ✗ Registry error:`, e); }
  }

  console.log("\nGenerating Community (OTX) articles...");
  for (const topic of COMMUNITY_TOPICS) {
    try {
      const item = await generateCommunity(topic);
      allItems.push(item);
      process.stdout.write(`  ✓ ${topic.actor}: ${topic.threat.slice(0, 50)}\n`);
    } catch (e) { console.error(`  ✗ Community error:`, e); }
  }

  console.log("\nGenerating Forum articles...");
  for (const topic of FORUM_TOPICS) {
    try {
      const item = await generateForum(topic);
      allItems.push(item);
      process.stdout.write(`  ✓ ${topic.outlet}: ${topic.headline.slice(0, 50)}\n`);
    } catch (e) { console.error(`  ✗ Forum error:`, e); }
  }

  console.log(`\nInserting ${allItems.length} items into Supabase...`);
  const BATCH = 20;
  let inserted = 0;
  for (let i = 0; i < allItems.length; i += BATCH) {
    const batch = allItems.slice(i, i + BATCH);
    const { error } = await supabase.from("threats").insert(batch);
    if (error) { console.error("Insert error:", error.message); }
    else { inserted += batch.length; process.stdout.write(`  Inserted ${inserted}/${allItems.length}\r`); }
  }

  console.log(`\n\nDone. ${inserted} articles inserted across all three tabs.`);
  const { count } = await supabase.from("threats").select("*", { count: "exact", head: true });
  console.log(`Total threats in DB: ${count}`);
}

main().catch(console.error);
