/**
 * Formal attestation PDF (HIPAA SRA / SOC 2 readiness) — the native-download
 * twin of app/app/attestations/[id]/print. Section-for-section parity with
 * the print view, including the citations appendix and signature state.
 */
import { PdfDoc } from "./doc";
import type { AttestationSnapshot } from "@/lib/attestation/generate";

export interface AttestationPdfInput {
  id: string;
  type: "hipaa_sra" | "soc2_readiness";
  status: "draft" | "signed" | "superseded";
  snapshot: AttestationSnapshot;
  executive_summary: string | null;
  document_hash: string;
  period_start: string | null;
  period_end: string | null;
  generated_at: string;
  signer_name: string | null;
  signer_title: string | null;
  signed_at: string | null;
  signature_method: "e_signature" | "print_and_sign" | null;
  signature_ip: string | null;
  signature_statement: string | null;
}

export async function buildAttestationPdf(att: AttestationPdfInput): Promise<Uint8Array> {
  const doc = await PdfDoc.create();
  const snap = att.snapshot;
  const isHipaa = att.type === "hipaa_sra";

  doc.brandHeader([
    isHipaa ? "HIPAA SECURITY RISK ASSESSMENT" : "SOC 2 READINESS REPORT",
    `Generated ${new Date(att.generated_at).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}`,
  ]);

  doc.title(snap.practice_name);
  doc.subtitle(
    `${isHipaa ? "Security Risk Assessment - 45 CFR 164.308(a)(1)(ii)(A)" : "SOC 2 Trust Services Readiness"}` +
      ` - Assessment period ${att.period_start ?? "-"} to ${att.period_end ?? "-"}`
  );

  if (att.executive_summary) {
    doc.sectionTitle("Executive summary");
    doc.paragraph(att.executive_summary, { size: 11, lineGap: 1.55 });
  }

  doc.sectionTitle("Compliance posture");
  doc.table(
    [
      { header: "Framework", flex: 3 },
      { header: "Readiness", flex: 1, align: "right" },
      { header: "Satisfied", flex: 1, align: "right" },
      { header: "Total", flex: 1, align: "right" },
    ],
    [
      ...snap.readiness.map((r) => [
        r.framework_code,
        `${r.weighted_pct}%`,
        String(r.satisfied),
        String(r.total),
      ]),
      ["Overall", `${snap.overall_pct}%`, "-", "-"],
    ]
  );

  doc.sectionTitle(`Identified risks (${snap.risks.length})`);
  if (snap.risks.length === 0) {
    doc.paragraph("No open risks. All assessed controls are compliant.");
  } else {
    doc.table(
      [
        { header: "Control", flex: 1.4, mono: true },
        { header: "Risk", flex: 3.6 },
        { header: "Priority", flex: 1 },
      ],
      snap.risks.map((r) => [r.control_key, r.title, r.priority ?? "-"])
    );
  }

  doc.sectionTitle("Safeguards & supporting measures");
  doc.table(
    [
      { header: "Measure", flex: 4 },
      { header: "Value", flex: 1.6, align: "right" },
    ],
    [
      ["Safeguards verified in place", String(snap.safeguards_in_place)],
      [
        "Automated evidence checks (current)",
        `${snap.evidence_summary.total_current} (${snap.evidence_summary.pass} passing)`,
      ],
      ["PHI vendors with active BAA", `${snap.vendors.with_active_baa} of ${snap.vendors.total}`],
      [
        "Workforce members screened & cleared",
        `${snap.workforce_screening.cleared} of ${snap.workforce_screening.total_members}`,
      ],
    ]
  );

  if (snap.framework_coverage && Object.keys(snap.framework_coverage).length > 0) {
    doc.sectionTitle("Framework coverage");
    doc.paragraph(
      "Citations covered by at least one compliant control. Coverage gaps indicate requirements where the practice does not yet have a satisfying control in place - supporting evidence for audit prep, not an audit attestation.",
      { size: 9, color: doc.muted, spaceAfter: 6 }
    );
    doc.table(
      [
        { header: "Framework", flex: 2 },
        { header: "Citations covered", flex: 1.4, align: "right" },
        { header: "Total in library", flex: 1.4, align: "right" },
        { header: "Coverage", flex: 1, align: "right" },
      ],
      Object.entries(snap.framework_coverage)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, c]) => {
          const pct = c.total_citations > 0 ? Math.round((c.citations_covered / c.total_citations) * 100) : 0;
          return [code, String(c.citations_covered), String(c.total_citations), `${pct}%`];
        })
    );
  }

  const compliantStatements = (snap.controls ?? []).filter(
    (c) => c.status === "compliant" && c.report_output_text && c.report_output_text.trim().length > 0
  );
  const practiceStatements = compliantStatements.filter((c) => c.audience !== "fortify_internal");
  const fortifyStatements = compliantStatements.filter((c) => c.audience === "fortify_internal");

  if (practiceStatements.length > 0) {
    doc.sectionTitle(`Practice safeguard attestations (${practiceStatements.length})`);
    doc.paragraph(
      "The following statements describe safeguards the practice maintains, verified compliant at the time of generation.",
      { size: 9, color: doc.muted, spaceAfter: 6 }
    );
    for (const c of practiceStatements) doc.listItem(c.control_key, c.report_output_text!);
    doc.spacer(10);
  }

  if (fortifyStatements.length > 0) {
    doc.sectionTitle(`Fortify-maintained safeguards (${fortifyStatements.length})`);
    doc.paragraph("The following safeguards are maintained by Fortify on behalf of the practice.", {
      size: 9,
      color: doc.muted,
      spaceAfter: 6,
    });
    for (const c of fortifyStatements) doc.listItem(c.control_key, c.report_output_text!);
    doc.spacer(10);
  }

  const compliantWithCitations = (snap.controls ?? []).filter(
    (c) => c.status === "compliant" && Array.isArray(c.framework_citations) && c.framework_citations.length > 0
  );
  if (compliantWithCitations.length > 0) {
    doc.sectionTitle("Source citations per compliant control");
    doc.paragraph(
      'The specific framework requirements satisfied by each compliant control. This appendix answers "which regulation or standard does each safeguard map to?"',
      { size: 9, color: doc.muted, spaceAfter: 6 }
    );
    doc.table(
      [
        { header: "Control", flex: 1.6, mono: true },
        { header: "Framework", flex: 1.2 },
        { header: "Citation", flex: 3, mono: true },
      ],
      compliantWithCitations.flatMap((c) =>
        c.framework_citations.map((fc, idx) => [idx === 0 ? c.control_key : "", fc.framework, fc.citation])
      ),
      { fontSize: 8.5 }
    );
  }

  doc.sectionTitle("Attestation");
  if (att.signature_statement) doc.paragraph(att.signature_statement, { size: 11, lineGap: 1.55 });
  if (att.status === "signed") {
    doc.paragraph(`${att.signer_name ?? ""}${att.signer_title ? `, ${att.signer_title}` : ""}`, {
      font: "serif",
      bold: true,
      size: 12,
      spaceAfter: 2,
    });
    doc.paragraph(
      `${att.signature_method === "e_signature" ? "Electronically signed" : "Signed (wet-ink on file)"} on ` +
        `${att.signed_at ? new Date(att.signed_at).toLocaleString("en-US", { dateStyle: "long", timeZone: "UTC" }) : ""}` +
        `${att.signature_ip ? ` - IP ${att.signature_ip}` : ""}`,
      { font: "sans", size: 8.5, color: doc.muted }
    );
  } else {
    doc.signatureLines();
  }

  return doc.finalize([
    "Generated by Fortify. This document contains no Protected Health Information (45 CFR 160.103) - it reflects compliance program metadata only.",
    `Document integrity hash: ${att.document_hash}`,
    `Attestation ID: ${att.id}`,
  ]);
}
