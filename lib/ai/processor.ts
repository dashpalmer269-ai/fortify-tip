import Anthropic from '@anthropic-ai/sdk';
import { RawThreatInput } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AiEnrichment {
  headline: string;
  summary: string;
  credibility_score: number;
  is_critical: boolean;
  tags: string[];
}

export async function enrichThreat(
  input: RawThreatInput,
  existingCveSources: number
): Promise<AiEnrichment> {
  const credibilityContext =
    existingCveSources >= 3
      ? 'This CVE/topic appears in 3 or more other sources in our database (high cross-reference).'
      : existingCveSources === 2
      ? 'This CVE/topic appears in 2 other sources in our database (moderate cross-reference).'
      : 'This appears in only 1 source so far (low cross-reference).';

  const prompt = `You are a threat intelligence editor writing for a cybersecurity briefing read by both engineers and executives. Your job: turn raw threat data into a clean, scannable card.

THREAT DATA
Title: ${input.title}
CVE ID: ${input.cve_id ?? 'N/A'}
Severity: ${input.severity ?? 'unknown'}
Source: ${input.source_name}
Section: ${input.source_tab ?? 'unknown'}
Exploit Status: ${input.exploit_status ?? 'unknown'}
Fix Status: ${input.fix_status ?? 'unknown'}
Affected Products: ${(input.affected_products ?? []).join(', ') || 'N/A'}
Raw Content: ${(input.raw_content ?? '').slice(0, 2000)}

Cross-reference context: ${credibilityContext}

WRITE A NEWSPAPER-STYLE HEADLINE
- 4 to 7 words, ideally 5
- Lead with the vendor/product or actor when known
- Use active verbs ("Exploited", "Patched", "Leaked", "Hits", "Targets", "Breached")
- Plain English. No CVE IDs, no jargon acronyms unless universally known (RCE, XSS, DDoS, RAT are OK)
- Tone: urgent but factual. Think NYT, WSJ, BleepingComputer headlines
- Do NOT start with "CVE-", "Vulnerability in", "The", or generic words
- Title Case (capitalize main words)

GOOD HEADLINE EXAMPLES
"Cisco IOS XE Bug Exploited"
"WordPress Plugin Leaks 200K Sites"
"Linux Kernel Race Condition Patched"
"LockBit Hits Healthcare Networks"
"Chrome Zero-Day Under Active Attack"
"Apache Struts RCE Disclosed"

BAD HEADLINE EXAMPLES (do NOT do these)
"CVE-2024-1234 Vulnerability"   ← never lead with CVE
"Critical Security Issue Found"  ← too vague, no product
"In the Linux kernel, the following..."  ← raw text, not a headline
"A vulnerability was discovered in X" ← passive, too long

Respond in this EXACT JSON format. No markdown, no commentary, JSON only:
{
  "headline": "<4-7 word newspaper headline>",
  "summary": "<2-3 plain English sentences. What happened, who is at risk, what should be done. Conversational tone, no jargon. Like explaining to a smart friend who's not in security>",
  "credibility_score": <integer 1-10. 3+ sources = 9-10, 2 sources = 6-8, 1 source = 3-5>,
  "is_critical": <true if exploit_status is active AND severity is critical or high, else false>,
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}

Tags: 3-5 items. Vendor names, attack types ("RCE", "Phishing"), or actor names. Lowercase, no hashes.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';

  try {
    // Strip any accidental markdown fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as AiEnrichment;
    return {
      headline: cleanHeadline(parsed.headline) || fallbackHeadline(input),
      summary: parsed.summary ?? '',
      credibility_score: Math.min(10, Math.max(1, Number(parsed.credibility_score) || 5)),
      is_critical: Boolean(parsed.is_critical),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
    };
  } catch {
    return {
      headline: fallbackHeadline(input),
      summary: input.raw_content?.slice(0, 300) ?? input.title,
      credibility_score: existingCveSources >= 3 ? 9 : existingCveSources >= 2 ? 7 : 4,
      is_critical:
        input.exploit_status === 'active' &&
        (input.severity === 'critical' || input.severity === 'high'),
      tags: [],
    };
  }
}

function cleanHeadline(raw: string | undefined): string {
  if (!raw) return '';
  let h = raw.trim();
  h = h.replace(/^["']|["']$/g, '');
  h = h.replace(/^CVE-\d{4}-\d+:\s*/i, '');
  h = h.replace(/\.$/, '');
  // Cap length defensively
  if (h.length > 90) h = h.slice(0, 87) + '…';
  return h;
}

function fallbackHeadline(input: RawThreatInput): string {
  const t = (input.title ?? '').replace(/^CVE-\d{4}-\d+:\s*/i, '').trim();
  return t.length > 80 ? t.slice(0, 77) + '…' : t;
}

export async function searchThreats(query: string, context: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a threat intelligence assistant. A user searched for: "${query}"

Here are relevant threats from our database:
${context}

Provide a concise 2-4 sentence synthesis of what these threats have in common, the overall risk level, and recommended actions. Be direct and actionable.`,
      },
    ],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}
