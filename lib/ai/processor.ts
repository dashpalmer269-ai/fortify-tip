import Anthropic from '@anthropic-ai/sdk';
import { RawThreatInput } from '../types';
import { NO_PHI_AI_SYSTEM_PROMPT } from '@/lib/compliance/no-phi';

// Lazy init so the SDK reads ANTHROPIC_API_KEY at first call rather than module-load time.
// Standalone scripts load .env.local AFTER imports run, so module-time init would see undefined.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export interface AiEnrichment {
  is_relevant: boolean;
  headline: string;
  article_body: string;
  credibility_score: number;
  is_critical: boolean;
  tags: string[];
}

export interface ArticleContext {
  title: string;
  raw_content: string;
  source_name: string;
  source_tab?: string | null;
  cve_id?: string | null;
  severity?: string | null;
  affected_products?: string[] | null;
  cross_ref_count?: number;
}

// ─── Quality gates ────────────────────────────────────────────────────────────

const FORBIDDEN_HEADLINE_STARTS = /^(CVE-|A |An |The |New )/i;
const MARKDOWN_PATTERN = /(^|\n)\s*(#{1,6}\s|\*\*|##|\-\s|\*\s|\d+\.\s)/m;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function isTitleCase(s: string): boolean {
  // Allow small words like "of", "the", "and" to be lowercase mid-headline.
  const small = new Set(['of', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'a', 'an', 'by', 'via', 'as']);
  const words = s.trim().split(/\s+/);
  return words.every((w, i) => {
    const cleaned = w.replace(/[^A-Za-z0-9-]/g, '');
    if (cleaned.length === 0) return true;
    if (i > 0 && small.has(cleaned.toLowerCase())) return true;
    return /^[A-Z0-9]/.test(cleaned);
  });
}

interface ValidationResult { ok: boolean; reason: string }

function validate(headline: string, article: string): ValidationResult {
  const hw = wordCount(headline);
  if (hw < 3 || hw > 4) {
    return { ok: false, reason: `headline has ${hw} words but must be exactly 3 or 4 words` };
  }
  if (FORBIDDEN_HEADLINE_STARTS.test(headline.trim())) {
    return { ok: false, reason: `headline cannot start with "CVE-", "A", "An", "The", or "New"` };
  }
  if (!isTitleCase(headline)) {
    return { ok: false, reason: `headline must use Title Case (capitalize each main word)` };
  }
  if (/["'`]/.test(headline)) {
    return { ok: false, reason: `headline must not contain quotation marks` };
  }
  if (headline.endsWith('.') || headline.endsWith(',')) {
    return { ok: false, reason: `headline must not end with punctuation` };
  }

  const aw = wordCount(article);
  if (aw < 333) {
    return { ok: false, reason: `article body has ${aw} words but must be at least 333` };
  }
  if (MARKDOWN_PATTERN.test(article)) {
    return { ok: false, reason: `article must be plain prose paragraphs — no headings, bullets, or markdown` };
  }
  const paragraphCount = article.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  if (paragraphCount < 3) {
    return { ok: false, reason: `article must have at least 3 paragraphs (separated by blank lines)` };
  }
  if (/^(Headline|Article|Body|Story):/i.test(article.trim())) {
    return { ok: false, reason: `article must not start with a label like "Headline:" or "Article:"` };
  }

  return { ok: true, reason: '' };
}

function buildPrompt(ctx: ArticleContext, correction: string | null): string {
  const crossRef = ctx.cross_ref_count == null
    ? ''
    : ctx.cross_ref_count >= 3
    ? 'This topic appears in 3+ other sources (high cross-reference).'
    : ctx.cross_ref_count === 2
    ? 'This topic appears in 2 other sources (moderate cross-reference).'
    : 'This appears in only 1 source so far (low cross-reference).';

  const sourceBlock = [
    `Original title: ${ctx.title}`,
    ctx.cve_id ? `CVE: ${ctx.cve_id}` : null,
    ctx.severity ? `Severity: ${ctx.severity}` : null,
    ctx.source_name ? `Source: ${ctx.source_name}${ctx.source_tab ? ` (${ctx.source_tab})` : ''}` : null,
    ctx.affected_products?.length ? `Affected products: ${ctx.affected_products.slice(0, 8).join(', ')}` : null,
    `Raw source text:\n${(ctx.raw_content ?? '').slice(0, 3500)}`,
    crossRef,
  ].filter(Boolean).join('\n');

  const correctionBlock = correction
    ? `\n\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION: ${correction}\nFix this exact issue in your next response. All other rules still apply.`
    : '';

  return `You are a senior cybersecurity reporter writing for The Wall Street Journal and The New York Times. Your task: turn raw threat-intelligence data into a polished news article.

────────────────────────────────────────────────────────────────────────
REQUIREMENTS — APPLY STRICTLY. ACCURACY OVER SPEED.
────────────────────────────────────────────────────────────────────────

1) RELEVANCE GATE
   - Decide if this is a real cybersecurity incident, vulnerability, breach, exploit, or threat-actor activity.
   - If it is NOT (e.g., general tech news, AI/ML commentary, vendor marketing, opinion piece, productivity tip, conference review), set is_relevant=false and leave headline and article_body as empty strings. Do NOT publish off-topic content.

2) HEADLINE — EXACTLY 3 OR 4 WORDS
   - WSJ/NYT style. Title Case. No trailing punctuation. No quotation marks.
   - Active verbs: Hits, Patched, Exploited, Leaked, Breached, Discloses, Steals, Hijacks, Warns, Confirms.
   - Lead with the vendor/product/actor when possible.
   - Forbidden starts: "CVE-", "A ", "An ", "The ", "New ".
   GOOD HEADLINES
     • Cisco Patches Zero-Day
     • Ransomware Hits Hospitals
     • Microsoft Discloses Critical Flaw
     • Hackers Breach T-Mobile
     • LockBit Targets Healthcare
   BAD HEADLINES
     • CVE-2024-1234 Vulnerability (forbidden start, too generic)
     • Critical Security Issue Found (vague, no entity)
     • A New Threat Emerges (forbidden start)
     • Apache (one word)
     • Cisco IOS XE WebUI Vulnerability Patched (six words)

3) ARTICLE BODY — AT LEAST 333 WORDS, PLAIN PROSE
   - 3 or more paragraphs separated by blank lines. No bullets. No headings. No markdown.
   - Open with a strong WSJ/NYT lede paragraph: name the affected company/product/actor and the incident in the first sentence.
   - Middle paragraphs: how the threat works, scope, what's at risk, business impact, who discovered it (only if specified in source data).
   - Close with practical action: what defenders, users, or affected organizations should do now.
   - Stay factually grounded in the source text. Do NOT invent quotes, attributions, named individuals, specific dates, victim counts, or technical details that the source does not support. If a detail isn't in the source, write at the right level of abstraction without fabricating.
   - Tone: authoritative, engaging, accessible to a smart non-security reader. Avoid jargon-only sentences.
   - Do NOT begin the body with a label like "Headline:" or "Article:".

────────────────────────────────────────────────────────────────────────
SOURCE DATA
────────────────────────────────────────────────────────────────────────
${sourceBlock}${correctionBlock}

────────────────────────────────────────────────────────────────────────
OUTPUT
Respond ONLY with valid JSON in this exact shape — no markdown fences, no commentary:
{
  "is_relevant": true | false,
  "headline": "...",
  "article_body": "...",
  "credibility_score": <integer 1-10>,
  "is_critical": <true if active exploitation AND severity critical/high, else false>,
  "tags": ["...", "...", "..."]
}

Tags: 3-5 lowercase items (vendor names, attack types, actor names). Empty array if not relevant.`;
}

export async function generateArticle(ctx: ArticleContext, maxAttempts = 3): Promise<AiEnrichment | null> {
  let correction: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let parsed: Partial<AiEnrichment> | null = null;
    let rawText = '';

    try {
      const msg = await getClient().messages.create({
        system: NO_PHI_AI_SYSTEM_PROMPT,
        model: 'claude-opus-4-7',
        max_tokens: 2000,
        messages: [{ role: 'user', content: buildPrompt(ctx, correction) }],
      });
      rawText = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}';
    } catch (err) {
      // API-level failure (auth, billing, rate limit, network). Surface to caller — retrying won't fix.
      throw new Error(`Anthropic API call failed: ${(err as Error).message}`);
    }

    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned) as AiEnrichment;
    } catch (err) {
      correction = `your previous response was not valid JSON (${(err as Error).message}). Output ONLY the JSON object, no markdown, no commentary.`;
      continue;
    }

    // Off-topic: accept and short-circuit, no validation needed.
    if (parsed.is_relevant === false) {
      return {
        is_relevant: false,
        headline: '',
        article_body: '',
        credibility_score: 1,
        is_critical: false,
        tags: [],
      };
    }

    const headline = (parsed.headline ?? '').trim().replace(/^["']|["']$/g, '');
    const article = (parsed.article_body ?? '').trim();
    const validation = validate(headline, article);

    if (validation.ok) {
      // Final re-verification (defensive — same gate, applied to final values)
      const reverify = validate(headline, article);
      if (reverify.ok) {
        return {
          is_relevant: true,
          headline,
          article_body: article,
          credibility_score: Math.min(10, Math.max(1, Number(parsed.credibility_score) || 5)),
          is_critical: Boolean(parsed.is_critical),
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
        };
      }
    }

    correction = validation.reason;
  }

  // Quality bar not met after all retries — caller decides to skip.
  return null;
}

export async function enrichThreat(
  input: RawThreatInput,
  existingCveSources: number
): Promise<AiEnrichment | null> {
  return generateArticle({
    title: input.title,
    raw_content: input.raw_content ?? '',
    source_name: input.source_name,
    source_tab: input.source_tab,
    cve_id: input.cve_id,
    severity: input.severity,
    affected_products: input.affected_products,
    cross_ref_count: existingCveSources,
  });
}

export async function searchThreats(query: string, context: string): Promise<string> {
  const message = await getClient().messages.create({
        system: NO_PHI_AI_SYSTEM_PROMPT,
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

  return message.content[0]?.type === 'text' ? message.content[0].text : '';
}
