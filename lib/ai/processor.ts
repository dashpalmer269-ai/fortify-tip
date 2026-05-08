import Anthropic from '@anthropic-ai/sdk';
import { RawThreatInput } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AiEnrichment {
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

  const prompt = `You are a threat intelligence analyst. Analyze the following cybersecurity threat and provide structured output.

THREAT DATA:
Title: ${input.title}
CVE ID: ${input.cve_id ?? 'N/A'}
Severity: ${input.severity ?? 'unknown'}
Source: ${input.source_name}
Exploit Status: ${input.exploit_status ?? 'unknown'}
Fix Status: ${input.fix_status ?? 'unknown'}
Affected Products: ${(input.affected_products ?? []).join(', ') || 'N/A'}
Raw Content: ${(input.raw_content ?? '').slice(0, 1500)}

Cross-reference context: ${credibilityContext}

Respond in this exact JSON format (no markdown, no extra text):
{
  "summary": "<2-3 plain English sentences explaining what this threat is, who is affected, and what action should be taken>",
  "credibility_score": <integer 1-10 based on cross-reference context: 3+ sources = 9-10, 2 sources = 6-8, 1 source = 3-5>,
  "is_critical": <true if exploit_status is active AND fix_status is fixing AND severity is critical or high, else false>,
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}

Tags should be 3-5 items: vendor names, attack vectors (e.g. "RCE", "SQLi"), product categories, or threat actor names.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';

  try {
    const parsed = JSON.parse(text) as AiEnrichment;
    return {
      summary: parsed.summary ?? '',
      credibility_score: Math.min(10, Math.max(1, Number(parsed.credibility_score) || 5)),
      is_critical: Boolean(parsed.is_critical),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
    };
  } catch {
    return {
      summary: input.raw_content?.slice(0, 300) ?? input.title,
      credibility_score: existingCveSources >= 3 ? 9 : existingCveSources >= 2 ? 7 : 4,
      is_critical:
        input.exploit_status === 'active' &&
        input.fix_status === 'fixing' &&
        (input.severity === 'critical' || input.severity === 'high'),
      tags: [],
    };
  }
}

export async function searchThreats(query: string, context: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
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
