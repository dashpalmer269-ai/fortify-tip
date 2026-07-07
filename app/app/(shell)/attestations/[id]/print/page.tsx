import { notFound } from "next/navigation";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import type { AttestationSnapshot } from "@/lib/attestation/generate";

export const dynamic = "force-dynamic";

/**
 * Print-optimized formal attestation document. The legal artifact for the
 * print-and-sign path; also the "Download PDF" target for e-signed copies.
 */
export default async function AttestationPrint({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { id } = await params;
  const { autoprint } = await searchParams;
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const { data: att } = await supabase
    .from("attestations")
    .select("*")
    .eq("id", id)
    .eq("practice_id", session.membership.practice_id)
    .maybeSingle();
  if (!att) notFound();

  const snap = att.snapshot as unknown as AttestationSnapshot;
  const isHipaa = att.type === "hipaa_sra";

  return (
    <div className="att-doc">
      <header className="att-header">
        <div className="brand">FORTIFY</div>
        <div className="meta">
          <p>{isHipaa ? "HIPAA SECURITY RISK ASSESSMENT" : "SOC 2 READINESS REPORT"}</p>
          <p>Generated {new Date(att.generated_at).toLocaleDateString("en-US", { dateStyle: "long" })}</p>
        </div>
      </header>

      <h1>{snap.practice_name}</h1>
      <p className="subtitle">
        {isHipaa ? "Security Risk Assessment — 45 CFR §164.308(a)(1)(ii)(A)" : "SOC 2 Trust Services Readiness"}
        {" · "}Assessment period {att.period_start} to {att.period_end}
      </p>

      {att.executive_summary && (
        <section>
          <h2>Executive summary</h2>
          <p className="prose">{att.executive_summary}</p>
        </section>
      )}

      <section>
        <h2>Compliance posture</h2>
        <table>
          <thead>
            <tr><th>Framework</th><th className="num">Readiness</th><th className="num">Satisfied</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {snap.readiness.map((r) => (
              <tr key={r.framework_code}>
                <td>{r.framework_code}</td>
                <td className="num">{r.weighted_pct}%</td>
                <td className="num">{r.satisfied}</td>
                <td className="num">{r.total}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td><strong>Overall</strong></td>
              <td className="num"><strong>{snap.overall_pct}%</strong></td>
              <td className="num">—</td>
              <td className="num">—</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Identified risks ({snap.risks.length})</h2>
        {snap.risks.length === 0 ? (
          <p className="prose">No open risks. All assessed controls are compliant.</p>
        ) : (
          <table>
            <thead><tr><th>Control</th><th>Risk</th><th>Priority</th></tr></thead>
            <tbody>
              {snap.risks.map((r) => (
                <tr key={r.control_key}>
                  <td className="mono">{r.control_key}</td>
                  <td>{r.title}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.priority ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Safeguards & supporting measures</h2>
        <table>
          <tbody>
            <tr><td>Safeguards verified in place</td><td className="num">{snap.safeguards_in_place}</td></tr>
            <tr><td>Automated evidence checks (current)</td><td className="num">{snap.evidence_summary.total_current} ({snap.evidence_summary.pass} passing)</td></tr>
            <tr><td>PHI vendors with active BAA</td><td className="num">{snap.vendors.with_active_baa} of {snap.vendors.total}</td></tr>
            <tr><td>Workforce members screened &amp; cleared</td><td className="num">{snap.workforce_screening.cleared} of {snap.workforce_screening.total_members}</td></tr>
          </tbody>
        </table>
      </section>

      {/* Framework coverage map — shown when the snapshot carries it (post-038 snapshots) */}
      {snap.framework_coverage && Object.keys(snap.framework_coverage).length > 0 && (
        <section>
          <h2>Framework coverage</h2>
          <p className="prose" style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Citations covered by at least one compliant control. Coverage gaps indicate requirements
            where the practice does not yet have a satisfying control in place — supporting evidence
            for audit prep, not an audit attestation.
          </p>
          <table>
            <thead>
              <tr><th>Framework</th><th className="num">Citations covered</th><th className="num">Total citations in library</th><th className="num">Coverage</th></tr>
            </thead>
            <tbody>
              {Object.entries(snap.framework_coverage)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([code, c]) => {
                  const pct = c.total_citations > 0 ? Math.round((c.citations_covered / c.total_citations) * 100) : 0;
                  return (
                    <tr key={code}>
                      <td>{code}</td>
                      <td className="num">{c.citations_covered}</td>
                      <td className="num">{c.total_citations}</td>
                      <td className="num">{pct}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      )}

      {/* Per-control attestation statements — only render for compliant controls that carry a report sentence. */}
      {(() => {
        const compliantStatements = (snap.controls ?? []).filter(
          (c) => c.status === "compliant" && c.report_output_text && c.report_output_text.trim().length > 0
        );
        const practiceStatements = compliantStatements.filter((c) => c.audience !== "fortify_internal");
        const fortifyStatements = compliantStatements.filter((c) => c.audience === "fortify_internal");
        if (compliantStatements.length === 0) return null;
        return (
          <>
            {practiceStatements.length > 0 && (
              <section>
                <h2>Practice safeguard attestations ({practiceStatements.length})</h2>
                <p className="prose" style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                  The following statements describe safeguards the practice maintains, verified compliant at the time of generation.
                </p>
                <ul className="stmt-list">
                  {practiceStatements.map((c) => (
                    <li key={c.control_key}>
                      <span className="stmt-key">{c.control_key}</span>{" "}
                      <span className="stmt-text">{c.report_output_text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {fortifyStatements.length > 0 && (
              <section>
                <h2>Fortify-maintained safeguards ({fortifyStatements.length})</h2>
                <p className="prose" style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                  The following safeguards are maintained by Fortify on behalf of the practice.
                </p>
                <ul className="stmt-list">
                  {fortifyStatements.map((c) => (
                    <li key={c.control_key}>
                      <span className="stmt-key">{c.control_key}</span>{" "}
                      <span className="stmt-text">{c.report_output_text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        );
      })()}

      {/* Detailed framework citations per compliant control — the audit-defensibility appendix */}
      {(() => {
        const compliantWithCitations = (snap.controls ?? []).filter(
          (c) => c.status === "compliant" && Array.isArray(c.framework_citations) && c.framework_citations.length > 0
        );
        if (compliantWithCitations.length === 0) return null;
        return (
          <section>
            <h2>Source citations per compliant control</h2>
            <p className="prose" style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
              The specific framework requirements satisfied by each compliant control. This appendix
              answers &ldquo;which regulation or standard does each safeguard map to?&rdquo;
            </p>
            <table>
              <thead>
                <tr><th>Control</th><th>Framework</th><th>Citation</th></tr>
              </thead>
              <tbody>
                {compliantWithCitations.flatMap((c) =>
                  c.framework_citations.map((fc, idx) => (
                    <tr key={`${c.control_key}-${fc.framework}-${fc.citation}-${idx}`}>
                      <td className="mono">{idx === 0 ? c.control_key : ""}</td>
                      <td>{fc.framework}</td>
                      <td className="mono">
                        {fc.source_url ? (
                          <a href={fc.source_url} target="_blank" rel="noopener noreferrer">{fc.citation}</a>
                        ) : (
                          fc.citation
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        );
      })()}

      <section className="signature-block">
        <h2>Attestation</h2>
        {att.signature_statement && <p className="prose">{att.signature_statement}</p>}
        {att.status === "signed" ? (
          <div className="signed">
            <p><strong>{att.signer_name}</strong>{att.signer_title ? `, ${att.signer_title}` : ""}</p>
            <p className="sig-meta">
              {att.signature_method === "e_signature" ? "Electronically signed" : "Signed (wet-ink on file)"} on{" "}
              {att.signed_at ? new Date(att.signed_at).toLocaleString("en-US", { dateStyle: "long" }) : ""}
              {att.signature_ip ? ` · IP ${att.signature_ip}` : ""}
            </p>
          </div>
        ) : (
          <div className="sign-lines">
            <div className="line"><span>Signature</span></div>
            <div className="line short"><span>Printed name &amp; title</span></div>
            <div className="line short"><span>Date</span></div>
          </div>
        )}
      </section>

      <footer className="att-footer">
        <p>Generated by Fortify. This document contains no Protected Health Information (45 CFR §160.103) — it reflects compliance program metadata only.</p>
        <p className="mono">Document integrity hash: {att.document_hash}</p>
        <p className="mono">Attestation ID: {att.id}</p>
      </footer>

      {/* Screen-only reminder banner — hidden on print */}
      <div className="print-instructions">
        <p>
          <strong>Save as PDF:</strong> In your browser&apos;s Print dialog, choose &ldquo;Save as PDF&rdquo; as the destination.
          This document is letter-sized and styled for both print and PDF export.
        </p>
      </div>

      {autoprint !== "0" && (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('load',()=>setTimeout(()=>window.print(),250));`,
          }}
        />
      )}

      <style>{`
        @page { size: letter; margin: 0.75in; }
        html, body { background:#fff; color:#111; font-family:'Times New Roman',Georgia,serif; }
        .att-doc { max-width:7.5in; margin:0 auto; padding:0.5in 0.25in; line-height:1.55; }
        .att-header { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
        .brand { font-size:12px; font-weight:800; letter-spacing:5px; }
        .meta { text-align:right; font-size:10px; color:#555; } .meta p { margin:0; }
        h1 { font-size:30px; margin:0 0 4px; letter-spacing:-0.01em; }
        .subtitle { color:#555; margin:0 0 30px; font-size:13px; font-style:italic; }
        h2 { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#555; margin:26px 0 10px; border-bottom:1px solid #ddd; padding-bottom:6px; }
        table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:8px; }
        th, td { padding:7px 6px; text-align:left; border-bottom:1px solid #eee; }
        th { font-family:-apple-system,sans-serif; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#555; }
        td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
        .mono { font-family:'Courier New',monospace; font-size:11px; }
        .prose { font-size:14px; line-height:1.7; white-space:pre-wrap; }
        .total-row td { border-top:2px solid #111; }
        .signature-block { margin-top:36px; }
        .signed p { margin:4px 0; } .sig-meta { font-size:11px; color:#666; font-family:-apple-system,sans-serif; }
        .sign-lines { margin-top:32px; }
        .sign-lines .line { border-bottom:1px solid #111; height:36px; margin-bottom:22px; position:relative; max-width:5in; }
        .sign-lines .line.short { max-width:3.2in; }
        .sign-lines .line span { position:absolute; bottom:-16px; left:0; font-size:10px; color:#777; font-family:-apple-system,sans-serif; text-transform:uppercase; letter-spacing:1px; }
        .att-footer { margin-top:48px; padding-top:14px; border-top:1px solid #ddd; font-size:10px; color:#666; font-family:-apple-system,sans-serif; }
        .att-footer p { margin:4px 0; }
        .stmt-list { list-style:none; padding:0; margin:0; }
        .stmt-list li { padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:12.5px; line-height:1.55; }
        .stmt-list li:last-child { border-bottom:none; }
        .stmt-key { display:inline-block; font-family:'Courier New',monospace; font-size:10.5px; color:#555; background:#f5f5f5; padding:1px 5px; border-radius:2px; margin-right:6px; }
        .stmt-text { color:#222; }
        .print-instructions { position:fixed; top:10px; right:10px; max-width:280px; padding:10px 14px; background:#fef3c7; border:1px solid #fbbf24; border-radius:8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; line-height:1.5; color:#92400e; box-shadow:0 4px 12px rgba(0,0,0,0.08); z-index:9999; }
        .print-instructions p { margin:0; }
        .print-instructions strong { color:#78350f; }
        @media print { .att-doc { padding:0; } .print-instructions { display:none; } }
      `}</style>
    </div>
  );
}
