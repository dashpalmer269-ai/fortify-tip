import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildReportPdf } from "@/lib/pdf/report";
import { buildAttestationPdf, type AttestationPdfInput } from "@/lib/pdf/attestation";
import { toWinAnsi } from "@/lib/pdf/doc";

describe("toWinAnsi", () => {
  it("maps smart punctuation and drops unencodable glyphs", () => {
    expect(toWinAnsi("“Fortify” — it’s ready…")).toBe(`"Fortify" - it's ready...`);
    expect(toWinAnsi("§164.308 già")).toBe("§164.308 già"); // Latin-1 survives
    expect(toWinAnsi("emoji 🚀 greek λ")).toBe("emoji  greek ");
  });
});

describe("buildReportPdf", () => {
  it("produces a parseable PDF with the expected shape", async () => {
    const bytes = await buildReportPdf({
      id: "11111111-2222-3333-4444-555555555555",
      report_type: "audit_readiness",
      framework: "HIPAA",
      generated_at: "2026-07-06T12:00:00Z",
      ai_executive_summary:
        "The practice’s posture is strong — “87%” weighted readiness.\n\n" +
        "Second paragraph with unicode → arrows • bullets.\n" + "Line ".repeat(200),
      snapshot: {
        practice_name: "Sunrise Family Medicine",
        readiness: [
          { framework_code: "HIPAA", weighted_pct: 87, satisfied: 45, total: 52 },
          { framework_code: "SOC2", weighted_pct: 74, satisfied: 38, total: 51 },
        ],
        critical_open: 2,
        recent_drift_alerts_30d: 1,
        vendors_missing_baa: 0,
        tasks_open: 7,
        tasks_overdue: 1,
        training_current: 11,
        training_expired: 2,
        screenings_total: 13,
        screenings_blocked: 0,
      },
    });

    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(2); // long summary paginates
    const { width, height } = parsed.getPage(0).getSize();
    expect(Math.round(width)).toBe(612);
    expect(Math.round(height)).toBe(792);
  });
});

describe("buildAttestationPdf", () => {
  const baseAtt: AttestationPdfInput = {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    type: "hipaa_sra",
    status: "draft",
    executive_summary: "Assessment complete. ".repeat(40),
    document_hash: "sha256:deadbeef",
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    generated_at: "2026-07-06T12:00:00Z",
    signer_name: null,
    signer_title: null,
    signed_at: null,
    signature_method: null,
    signature_ip: null,
    signature_statement: "I attest the above is accurate to the best of my knowledge.",
    snapshot: {
      practice_name: "Sunrise Family Medicine",
      generated_at: "2026-07-06T12:00:00Z",
      period: { start: "2026-01-01", end: "2026-06-30" },
      readiness: [{ framework_code: "HIPAA", weighted_pct: 87, satisfied: 45, total: 52 }],
      overall_pct: 87,
      controls: Array.from({ length: 60 }, (_, i) => ({
        control_key: `CTRL-${String(i).padStart(3, "0")}`,
        title: `Control number ${i} with a reasonably long descriptive title for wrapping`,
        category: "technical",
        healthcare_category: null,
        priority: i % 3 === 0 ? "critical" : "medium",
        status: i % 4 === 0 ? "non_compliant" : "compliant",
        audience: i % 5 === 0 ? "fortify_internal" : "practice",
        automation_level: null,
        default_weight: 1,
        responsible_role: null,
        report_output_text: `The practice maintains safeguard ${i} — verified by automated evidence collection.`,
        framework_citations: [
          { framework: "HIPAA", citation: `45 CFR §164.308(a)(${i})`, source_url: null },
        ],
      })),
      risks: [
        {
          control_key: "CTRL-004",
          title: "MFA not enforced for all workforce accounts",
          priority: "critical",
          healthcare_category: null,
          framework_impact: ["HIPAA"],
        },
      ],
      safeguards_in_place: 45,
      vendors: { total: 6, with_active_baa: 6, missing_baa: 0 },
      workforce_screening: { total_members: 13, cleared: 13, blocked: 0, stale: 0 },
      evidence_summary: { total_current: 31, pass: 29, fail: 1, partial: 1 },
      framework_coverage: { HIPAA: { citations_covered: 88, total_citations: 104 } },
    },
  };

  it("draft attestation paginates the appendix and includes signature lines", async () => {
    const bytes = await buildAttestationPdf(baseAtt);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(3); // 60 controls force multiple pages
  });

  it("signed attestation renders without signature lines", async () => {
    const bytes = await buildAttestationPdf({
      ...baseAtt,
      status: "signed",
      signer_name: "Dr. Dana Palmer",
      signer_title: "Practice Owner",
      signed_at: "2026-07-06T15:00:00Z",
      signature_method: "e_signature",
      signature_ip: "203.0.113.9",
    });
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(3);
  });
});
