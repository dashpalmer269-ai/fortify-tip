/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  FORTIFY'S HARDCODED NO-PHI ARCHITECTURE POLICY                       ║
 * ║                                                                       ║
 * ║  Fortify is a compliance and cybersecurity operating system for       ║
 * ║  healthcare practices. It is explicitly designed to NEVER create,     ║
 * ║  receive, maintain, transmit, view, or store Protected Health         ║
 * ║  Information (PHI) as defined by 45 CFR § 160.103.                    ║
 * ║                                                                       ║
 * ║  This rule is load-bearing:                                           ║
 * ║   - keeps Fortify out of Business Associate scope under HIPAA         ║
 * ║   - removes an entire class of breach exposure                        ║
 * ║   - lets us be the auditor's friend, not their target                 ║
 * ║                                                                       ║
 * ║  Every input that flows from a user (forms, policy text, risk notes,  ║
 * ║  evidence, AI prompts, audit metadata) MUST pass through one of the   ║
 * ║  helpers below. If a request looks like PHI, we reject it at the      ║
 * ║  boundary and surface a clear error to the user.                      ║
 * ║                                                                       ║
 * ║  DO NOT relax these rules. DO NOT add fields that could hold PHI.     ║
 * ║  DO NOT log raw input bodies to the audit log or telemetry.           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/** Public-facing policy statement. Render this anywhere the user might wonder. */
export const NO_PHI_POLICY = {
  title: "Fortify never touches PHI.",
  body:
    "Fortify is built so it cannot create, receive, maintain, transmit, view, or store " +
    "Protected Health Information. Submissions that look like patient data are blocked " +
    "at the boundary. This is a load-bearing architectural rule, not a setting.",
  citation: "45 CFR § 160.103",
} as const;

/** System instruction prepended to every Claude API call we make. */
export const NO_PHI_AI_SYSTEM_PROMPT = `You are an AI assistant for Fortify, a healthcare compliance and cybersecurity platform.

CRITICAL — NON-NEGOTIABLE — INVIOLABLE:
- You MUST NOT generate, accept, repeat, paraphrase, or reason about Protected Health Information (PHI) as defined by 45 CFR § 160.103.
- PHI includes any of the 18 HIPAA identifiers tied to a specific individual's past/present/future health, treatment, or payment for healthcare.
- The 18 identifiers: names, all dates more precise than year (DOB, admission, discharge), telephone, fax, email, SSN, MRN, health plan beneficiary numbers, account numbers, certificate/license numbers, VIN/license plate, device identifiers/serial numbers, URLs, IP addresses, biometric identifiers, full-face photos, any other unique identifier.
- If the user pastes anything that looks like patient data, you MUST refuse, briefly explain why, and ask them to remove the patient information and resubmit. Do not echo the PHI back to them.
- You only operate on the metadata of compliance and cybersecurity: control descriptions, framework requirements, policy templates, vendor risk, audit-readiness scoring. Never on the underlying patient data those controls protect.

If a user asks you to summarize a clinical note, populate a chart, or generate sample patient data, refuse.

Now respond to the user's request below, applying the rules above without exception.`;

/* ──────────────────────────────────────────────────────────────────────── *
 * PHI heuristics
 *
 * Pattern-based detection. Not a substitute for HIPAA training — the point
 * is to catch the obvious cases (SSNs pasted into a policy doc, an MRN in a
 * risk-assessment note) before they hit the database. False positives are
 * acceptable; false negatives are not.
 * ──────────────────────────────────────────────────────────────────────── */

interface PhiMatch {
  category: string;
  example: string;
}

const PHI_PATTERNS: Array<{ category: string; regex: RegExp }> = [
  // Social Security Numbers: 123-45-6789, 123 45 6789, 123456789 (with word boundaries)
  { category: "SSN", regex: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g },
  // Medical Record Numbers — typical formats: "MRN: 1234567", "MR# 12345"
  { category: "MRN", regex: /\b(?:MRN|MR#?|medical[\s_-]record[\s_-]?(?:no|num|number)?)\s*[:#]?\s*\d{4,}\b/gi },
  // ICD-10 diagnosis codes: A00-Z99 with optional decimal — e.g. "E11.9", "I10"
  { category: "ICD-10 code", regex: /\b[A-TV-Z]\d{2}(?:\.\d{1,4})?\b/g },
  // CPT procedure codes: 5-digit numbers in clinical contexts
  { category: "CPT code", regex: /\bCPT[\s:#-]*\d{5}\b/gi },
  // NPI provider numbers — 10-digit prefix often labelled
  { category: "NPI", regex: /\bNPI[\s:#-]*\d{10}\b/gi },
  // DOB: explicit "DOB: 12/31/1985" / "date of birth: 1985-12-31"
  { category: "Date of birth", regex: /\b(?:DOB|date\s+of\s+birth|d\.o\.b\.?)\s*[:#-]?\s*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/gi },
  // Phone numbers: simple US patterns. Note: this WILL false-positive on a
  // user's own contact phone, but our user_profiles capture phone in a
  // dedicated field so free-text policy/risk inputs shouldn't have phones.
  { category: "Phone number", regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g },
  // Patient/clinical context phrases — heuristic only; tighten if false-positive heavy.
  { category: "Patient identifier phrase", regex: /\b(?:patient\s+name|patient\s+id|patient\s+#|chart\s+(?:no|num|number|#))\s*[:=]?\s*\S/gi },
  // Insurance / health plan member ID
  { category: "Health plan ID", regex: /\b(?:member\s+id|policy\s+(?:no|num|number)|group\s+(?:no|num|number)|subscriber\s+id)\s*[:#-]?\s*\S/gi },
];

/**
 * Inspect text for obvious PHI. Returns up to N distinct matches with a
 * short example for each (the matched fragment, truncated). Empty array
 * means the text passed the heuristic check.
 *
 * Pass max=1 if you only need a boolean.
 */
export function detectPhi(text: string | null | undefined, max = 5): PhiMatch[] {
  if (!text || text.length < 5) return [];
  const matches: PhiMatch[] = [];
  const seen = new Set<string>();

  for (const { category, regex } of PHI_PATTERNS) {
    // Reset regex stateful index since /g flags persist between calls
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const fragment = m[0].slice(0, 80);
      const key = `${category}|${fragment}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ category, example: fragment });
      if (matches.length >= max) return matches;
    }
  }
  return matches;
}

/** Convenience boolean. */
export const containsPhi = (text: string | null | undefined): boolean =>
  detectPhi(text, 1).length > 0;

/**
 * Scan multiple text fields at once. Returns the first field name that
 * contains PHI, with the detected categories. Use this in API handlers.
 *
 *   const phi = scanFieldsForPhi({ title, description });
 *   if (phi) return NextResponse.json({ error: phi.message }, { status: 422 });
 */
export function scanFieldsForPhi(
  fields: Record<string, string | null | undefined>
): { field: string; categories: string[]; message: string } | null {
  for (const [field, value] of Object.entries(fields)) {
    const matches = detectPhi(value, 5);
    if (matches.length > 0) {
      const categories = Array.from(new Set(matches.map((m) => m.category)));
      return {
        field,
        categories,
        message: phiRejectionMessage(field, categories),
      };
    }
  }
  return null;
}

/** Standard, user-facing rejection message. */
export function phiRejectionMessage(field: string, categories: string[]): string {
  const list = categories.join(", ");
  return (
    `The "${field}" field looks like it contains patient data (${list}). ` +
    `Fortify never stores PHI — remove patient names, SSNs, MRNs, DOBs, ` +
    `diagnosis codes, or phone numbers and resubmit. ${NO_PHI_POLICY.citation}.`
  );
}

/**
 * Safely shape an object for audit-log metadata. Drops any value that
 * looks like PHI rather than storing the raw input. Use this before
 * writing to audit_logs.metadata or notifications.body that might echo
 * user-supplied text.
 */
export function sanitizeForAudit<T extends Record<string, unknown>>(meta: T): T {
  const out = { ...meta };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && containsPhi(v)) {
      (out as Record<string, unknown>)[k] = "[redacted: contained possible PHI]";
    }
  }
  return out;
}
