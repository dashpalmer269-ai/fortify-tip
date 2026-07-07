import Link from "next/link";
import { notFound } from "next/navigation";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { isAdmin, type Role } from "@/lib/auth/permissions";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { AttestationSnapshot } from "@/lib/attestation/generate";
import SignPanel from "./SignPanel";

export const dynamic = "force-dynamic";

export default async function AttestationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAppSession();
  assertActive(session);
  const role = session.membership.role as Role;

  const supabase = await createAuthedServerClient();
  const { data: att } = await supabase
    .from("attestations")
    .select("*")
    .eq("id", id)
    .eq("practice_id", session.membership.practice_id)
    .maybeSingle();
  if (!att) notFound();

  const snap = att.snapshot as unknown as AttestationSnapshot;
  const isSigned = att.status === "signed";

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <Link href="/app/attestations" className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors">
        ← All attestations
      </Link>

      <div className="mt-6 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-[var(--color-primary)] leading-tight mb-2" style={{ letterSpacing: "-0.025em" }}>
            {att.title}
          </h1>
          <p className="font-mono text-[11px] text-[var(--color-tertiary)]">
            Generated {new Date(att.generated_at).toLocaleString("en-US", { dateStyle: "long" })} ·{" "}
            Period {att.period_start} → {att.period_end}
          </p>
        </div>
        <Badge variant={isSigned ? "success" : "warning"}>{isSigned ? "Signed" : "Draft"}</Badge>
      </div>

      {/* Signed banner */}
      {isSigned && (
        <Card className="mb-6">
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-2">
              Signature of record
            </p>
            <p className="text-sm text-[var(--color-primary)]">
              {att.signer_name}{att.signer_title ? `, ${att.signer_title}` : ""}
            </p>
            <p className="text-xs text-[var(--color-tertiary)] mt-1">
              {att.signature_method === "e_signature" ? "E-signed" : "Print & sign (wet-ink on file)"} ·{" "}
              {att.signed_at ? new Date(att.signed_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : ""}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Executive summary */}
      {att.executive_summary && (
        <Card className="mb-6">
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-3">
              Executive summary
            </p>
            <p className="text-[15px] text-[var(--color-primary)] leading-relaxed whitespace-pre-wrap">
              {att.executive_summary}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Posture snapshot */}
      <Card className="mb-6">
        <CardBody>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-4">
            Posture at generation
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <Metric label="Overall" value={`${snap.overall_pct}%`} />
            <Metric label="Safeguards" value={String(snap.safeguards_in_place)} />
            <Metric label="Open risks" value={String(snap.risks.length)} hot={snap.risks.length > 0} />
            <Metric label="BAAs missing" value={String(snap.vendors.missing_baa)} hot={snap.vendors.missing_baa > 0} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--color-border-subtle)] surface rounded-lg overflow-hidden">
            {snap.readiness.map((r) => (
              <div key={r.framework_code} className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-1">{r.framework_code}</p>
                <p className="font-display text-xl text-[var(--color-primary)] tabular-nums">{r.weighted_pct}%</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <a
          href={`/api/attestations/${att.id}/pdf`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover,#7c3aed)] text-white text-sm font-medium rounded-md transition-colors"
        >
          Download PDF
        </a>
        <Link
          href={`/app/attestations/${att.id}/print?autoprint=0`}
          target="_blank"
          rel="noopener"
          className="text-[13px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors"
        >
          Print view (wet-ink signing)
        </Link>
      </div>

      {/* Sign panel (admins, unsigned only) */}
      {isAdmin(role) && !isSigned && <SignPanel attestationId={att.id} />}
    </div>
  );
}

function Metric({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-1">{label}</p>
      <p
        className="font-display text-2xl tabular-nums"
        style={{ color: hot ? "var(--color-danger)" : "var(--color-primary)", letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
    </div>
  );
}
