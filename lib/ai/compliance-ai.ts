/**
 * Compliance-focused AI helpers.
 * Uses Sonnet 4.6 by default (cheaper, faster, plenty for these tasks) — keep
 * Opus 4.7 reserved for the threat-intel headline generator where prose quality
 * matters most.
 */
import Anthropic from "@anthropic-ai/sdk";
import { NO_PHI_AI_SYSTEM_PROMPT } from "@/lib/compliance/no-phi";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const MODEL = "claude-sonnet-4-6";

export interface RiskAssessmentContext {
  practice_name: string;
  practice_type: string | null;
  size_tier: string | null;
  framework: string;
  answers: Record<string, string | boolean | number>;
  current_readiness_pct: number | null;
  open_critical_controls: string[];
}

export interface RiskAssessmentAi {
  risk_score: number;            // 0-100, higher = more risk
  risk_level: "low" | "medium" | "high" | "critical";
  executive_summary: string;     // 3-4 paragraphs
  remediation_plan: string;      // ordered action plan markdown
}

export async function summarizeRiskAssessment(ctx: RiskAssessmentContext): Promise<RiskAssessmentAi> {
  const prompt = `You are a HIPAA-certified compliance auditor writing an executive risk summary for a small healthcare practice.

PRACTICE
Name: ${ctx.practice_name}
Type: ${ctx.practice_type ?? "unspecified"}
Size: ${ctx.size_tier ?? "unspecified"}
Framework focus: ${ctx.framework}
Current audit readiness: ${ctx.current_readiness_pct == null ? "unknown" : `${ctx.current_readiness_pct}%`}
Open critical controls: ${ctx.open_critical_controls.length === 0 ? "none" : ctx.open_critical_controls.join(", ")}

QUESTIONNAIRE ANSWERS
${Object.entries(ctx.answers).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

YOUR TASK
Produce a JSON object with:
- risk_score: integer 0-100 (higher = more risk)
- risk_level: "low" if score < 25, "medium" if 25-49, "high" if 50-74, "critical" if 75+
- executive_summary: 3-4 paragraphs, plain English, written for a practice owner or office manager (not a security pro). Cover what's working, what isn't, and why it matters in business terms — patient safety, liability, OCR fines, operational disruption.
- remediation_plan: an ordered markdown list of 5-8 concrete actions, each with a one-sentence why-it-matters and an estimated effort tag (e.g. "30 min", "1 day", "2 weeks").

Respond with ONLY the JSON object. No markdown fences, no commentary.`;

  const message = await getClient().messages.create({
    system: NO_PHI_AI_SYSTEM_PROMPT,
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<RiskAssessmentAi>;

  const score = Math.min(100, Math.max(0, Math.round(Number(parsed.risk_score) || 0)));
  const level: RiskAssessmentAi["risk_level"] =
    score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low";

  return {
    risk_score: score,
    risk_level: parsed.risk_level ?? level,
    executive_summary: parsed.executive_summary ?? "",
    remediation_plan: parsed.remediation_plan ?? "",
  };
}

export interface PolicyDraftContext {
  practice_name: string;
  practice_type: string | null;
  framework: string;
  policy_type: string;
  policy_title: string;
}

export async function draftPolicy(ctx: PolicyDraftContext): Promise<string> {
  const prompt = `You are a HIPAA / SOC 2 compliance consultant drafting an organizational policy document for a small healthcare practice.

PRACTICE
Name: ${ctx.practice_name}
Type: ${ctx.practice_type ?? "general medical practice"}

POLICY TO DRAFT
Framework: ${ctx.framework}
Policy type: ${ctx.policy_type}
Title: ${ctx.policy_title}

REQUIREMENTS
- Use plain language. The reader is a small-practice owner, not a legal team.
- Markdown headings (## and ###). No HTML.
- Cover: Purpose, Scope, Policy Statements (numbered), Roles & Responsibilities,
  Enforcement, Review Cadence, Revision History.
- Reference the specific framework requirement(s) this policy satisfies (e.g.
  "Satisfies HIPAA §164.308(a)(5)(i)") inline where appropriate.
- Length: 600-1000 words. Substantive but not bloated.
- Do not invent legal opinions or guarantees. Write organizational policy, not law.

Respond with ONLY the markdown body. No JSON wrapper, no preamble.`;

  const message = await getClient().messages.create({
    system: NO_PHI_AI_SYSTEM_PROMPT,
    model: MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  return text.trim();
}

export interface ReportContext {
  practice_name: string;
  report_type: string;
  framework: string | null;
  readiness_summary: Array<{ framework_code: string; weighted_pct: number; satisfied: number; total: number }>;
  critical_open: number;
  recent_drift_alerts: number;
  baas_missing: number;
}

export async function generateReportSummary(ctx: ReportContext): Promise<string> {
  const prompt = `You are a compliance officer writing an executive summary for the leadership of a small healthcare practice.

PRACTICE: ${ctx.practice_name}
REPORT TYPE: ${ctx.report_type}
FRAMEWORK FOCUS: ${ctx.framework ?? "all enabled frameworks"}

CURRENT STATE
${ctx.readiness_summary
  .map((r) => `- ${r.framework_code}: ${r.weighted_pct}% (${r.satisfied}/${r.total} requirements satisfied)`)
  .join("\n")}
- Critical controls open: ${ctx.critical_open}
- Recent configuration-drift alerts: ${ctx.recent_drift_alerts}
- Vendors with missing or expired BAAs: ${ctx.baas_missing}

YOUR TASK
Write a 4-paragraph executive summary suitable for the front page of a monthly compliance report.
Paragraph 1: Overall posture in one sentence + key headline numbers.
Paragraph 2: What's strong.
Paragraph 3: Where the practice is exposed — name the specific controls or gaps.
Paragraph 4: The top 3 priorities for the coming month with brief justification.

Plain English. No bullet points. No markdown headings. No quotation marks around the summary. Conversational executive tone.`;

  const message = await getClient().messages.create({
    system: NO_PHI_AI_SYSTEM_PROMPT,
    model: MODEL,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  return (message.content[0]?.type === "text" ? message.content[0].text : "").trim();
}
