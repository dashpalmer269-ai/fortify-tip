import Anthropic from '@anthropic-ai/sdk';
import { RawThreatInput } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AiEnrichment {
  is_relevant: boolean;
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

  const prompt = `You are a threat intelligence editor for a cybersecurity briefing platform. The platform ONLY covers: cybersecurity threats, data breaches, ransomware, malware, phishing, vulnerabilities (CVEs), exploits, hacking incidents, threat actors (APTs), and active digital attacks. It does NOT cover general tech news, AI commentary, opinion pieces, marketing posts, or off-topic content.

THREAT DATA
Title: ${input.title}
CVE ID: ${input.cve_id ?? 'N/A'}
Severity: ${input.severity ?? 'unknown'}
Source: ${input.source_name}
Section: ${input.source_tab ?? 'unknown'}
Affected Products: ${(input.affected_products ?? []).join(', ') || 'N/A'}
Raw Content: ${(input.raw_content ?? '').slice(0, 2000)}

Cross-reference context: ${credibilityContext}

STEP 1 — RELEVANCE GATE
Decide if this is a real cybersecurity threat/incident/vulnerability worth showing on a threat-intelligence platform.
- Mark RELEVANT (true): active vulnerabilities, CVEs, breaches, malware, ransomware, exploited bugs, APT campaigns, leaked credentials, zero-days, security incidents
- Mark NOT RELEVANT (false): general tech news, AI/ML commentary, vendor marketing posts, opinion pieces, off-topic content (e.g. divorce statistics, productivity tips, programming tutorials), security tooling reviews without an incident, conference talks
If is_relevant is false, set headline and summary to empty strings — they will not be shown.

STEP 2 — IF RELEVANT, WRITE A NEWSPAPER HEADLINE
- 4 to 7 words, ideally 5
- Lead with vendor/product/actor when known
- Active verbs: Exploited, Patched, Leaked, Hits, Targets, Breached, Discovered, Disclosed, Steals, Hijacks
- NEVER start with "CVE-", "A vulnerability", "The", "New" alone
- Title Case. No trailing period. No quotes.

STEP 3 — IF RELEVANT, WRITE A SUMMARY
2 to 3 plain English sentences. Cover: (1) what the threat/incident is, (2) who is at risk or affected, (3) what defenders should do. Conversational, like explaining to a smart non-security friend. NO jargon-only sentences.

GOOD HEADLINE EXAMPLES
- Cisco IOS XE Bug Exploited
- WordPress Plugin Leaks 200K Sites
- LockBit Hits Healthcare Networks
- Chrome Zero-Day Under Active Attack

Respond in this EXACT JSON format. No markdown, no commentary:
{
  "is_relevant": <true | false>,
  "headline": "<headline string or empty>",
  "summary": "<summary string or empty>",
  "credibility_score": <integer 1-10>,
  "is_critical": <true if exploit_status is active AND severity is critical or high, else false>,
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}

Tags: 3-5 lowercase items. Vendor names, attack types, actor names. Empty array if not relevant.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';

  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as AiEnrichment;
    const relevant = Boolean(parsed.is_relevant);
    return {
      is_relevant: relevant,
      headline: relevant ? cleanHeadline(parsed.headline) || fallbackHeadline(input) : '',
      summary: relevant ? (parsed.summary ?? '') : '',
      credibility_score: Math.min(10, Math.max(1, Number(parsed.credibility_score) || 5)),
      is_critical: Boolean(parsed.is_critical),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
    };
  } catch {
    return {
      is_relevant: true, // benefit of the doubt on parse errors
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
