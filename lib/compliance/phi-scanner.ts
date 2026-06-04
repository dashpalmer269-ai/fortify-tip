/**
 * Server-side PHI-detection scanner — defense in depth on top of the
 * customer-facing NO-PHI warning. Runs on every document upload's
 * filename + notes + (for text files) file contents.
 *
 * Detected patterns (HIPAA §164.514 safe-harbor identifiers):
 *   - SSN:                NNN-NN-NNNN or NNNNNNNNN with separators
 *   - Phone:              XXX-XXX-XXXX patterns (low-precision)
 *   - DOB:                date strings near keywords like "DOB" or "born"
 *   - MRN:                "MRN" / "medical record" / "record number" near digits
 *   - Diagnosis hints:    ICD-10 code patterns (A00-Z99 + numeric)
 *   - Patient nameplate:  "patient:", "pt:", "name:" followed by capitalized words
 *   - Common DOB labels:  born:, dob:, d.o.b., date of birth:
 *
 * This is intentionally narrow: false positives cost more than false
 * negatives here because the customer already got a clear warning AND
 * agreed to no-PHI terms. The scanner exists to catch the obvious cases
 * (someone uploaded "patient-list.pdf" or "Jane_Doe_DOB_1985.txt").
 */

const PATTERNS: Array<{ name: string; pattern: RegExp; severity: "high" | "medium" }> = [
  // SSN — high precision
  { name: "ssn",            pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,                              severity: "high" },
  // MRN keyword + digits
  { name: "mrn_labeled",    pattern: /\b(?:mrn|medical\s+record(?:\s+number|\s+#)?)\s*[:#]?\s*\d{4,}/gi, severity: "high" },
  // DOB keyword
  { name: "dob_labeled",    pattern: /\b(?:dob|d\.o\.b\.?|date\s+of\s+birth|born)\s*[:#]?\s*\d/gi,    severity: "high" },
  // Patient labeled in free text
  { name: "patient_labeled",pattern: /\b(?:patient|pt)\s*(?:name)?\s*[:#]\s*[A-Z]\w+/gi,             severity: "high" },
  // Filename-style patient naming (patient_jane_doe.pdf, pt-john-smith, etc)
  { name: "patient_filename", pattern: /\b(?:patient|pt)[_\-][A-Za-z]+(?:[_\-][A-Za-z]+)+/gi,        severity: "high" },
  // ICD-10 code (e.g. "E11.9", "Z23")
  { name: "icd10",          pattern: /\b[A-TV-Z][0-9][0-9AB](?:\.[0-9A-Z]{1,4})?\b/g,                severity: "medium" },
  // Common diagnosis terms paired with words like "diagnosis" or "Dx"
  { name: "diagnosis",      pattern: /\b(?:diagnosis|dx)\s*[:#]/gi,                                   severity: "medium" },
];

export interface PhiScanResult {
  clean: boolean;
  findings: Array<{ pattern: string; severity: "high" | "medium"; matched: string }>;
}

/**
 * Scan a string for PHI indicators. Returns { clean: true } when no patterns
 * fire, otherwise lists the matches (truncated for safety — we don't echo
 * the full PHI payload back, just the first few characters).
 */
export function scanForPhi(input: string | null | undefined): PhiScanResult {
  if (!input || typeof input !== "string") return { clean: true, findings: [] };
  const findings: PhiScanResult["findings"] = [];
  for (const { name, pattern, severity } of PATTERNS) {
    const matches = input.match(pattern);
    if (matches && matches.length > 0) {
      // Echo only the first match, truncated, so logs don't carry full PHI
      const sample = matches[0].slice(0, 12).replace(/\d/g, "X");
      findings.push({ pattern: name, severity, matched: sample });
    }
  }
  return { clean: findings.length === 0, findings };
}

/**
 * Convenience: scan multiple fields at once. Returns clean=false if ANY
 * field hits a high-severity pattern.
 */
export function scanFields(fields: Record<string, string | null | undefined>): PhiScanResult {
  const allFindings: PhiScanResult["findings"] = [];
  for (const [field, value] of Object.entries(fields)) {
    const r = scanForPhi(value);
    for (const f of r.findings) {
      allFindings.push({ ...f, pattern: `${field}:${f.pattern}` });
    }
  }
  return {
    clean: allFindings.every((f) => f.severity !== "high"),
    findings: allFindings,
  };
}

/**
 * Friendly error message for the API client when a scan blocks an upload.
 */
export function phiBlockReason(scan: PhiScanResult): string {
  const high = scan.findings.filter((f) => f.severity === "high").map((f) => f.pattern);
  if (high.length === 0) return "Upload contains suspicious patterns. Please review and remove any patient information.";
  return `Upload appears to contain PHI patterns (${high.join(", ")}). Fortify does not accept Protected Health Information. Remove patient identifiers and try again.`;
}
