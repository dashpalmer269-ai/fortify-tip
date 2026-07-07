import { getAppSession, assertActive } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import NoPhiWarning from "@/components/ui/NoPhiWarning";

export const dynamic = "force-dynamic";

const FAQS = [
  {
    q: "How does Fortify avoid storing PHI?",
    a: "Fortify is engineered as a compliance-management layer, not a PHI handler. Four independent layers enforce the no-PHI invariant: an AI prompt firewall, an API schema gate, a database CHECK constraint, and the in-product NO-PHI badge and upload warnings. See the architecture review at /architecture for the technical detail you can share with your auditor.",
  },
  {
    q: "What do I do if a control is marked non-compliant?",
    a: "Open the control on /app/compliance — the expanded panel shows step-by-step remediation. The same playbook appears on the matching task in your dashboard punch list. Most controls have an integration scan that re-checks within 24 hours; the failure clears automatically once the underlying configuration is fixed.",
  },
  {
    q: "Why is my readiness score so low?",
    a: "Readiness is risk-weighted. Critical controls (MFA, audit logs, backups, exclusion screening) count for 2.0× a baseline control; documentation refinements count for 0.5×. A failing MFA control will drop your score substantially more than a failing 'review the org chart' control. Open /app/coverage to see which framework citations are uncovered.",
  },
  {
    q: "How do I add a new workforce member?",
    a: "Have the new member sign up at /signup with their own email. They'll complete the standard-user onboarding and request to join your practice. You'll see the request on /app/team — approve it after the OIG LEIE exclusion screening completes (usually within seconds).",
  },
  {
    q: "How do I connect my Microsoft 365 / Google / AWS / Okta / DocuSign account?",
    a: "Open /app/integrations and click Connect on the integration you want. OAuth-based providers (M365, Google, DocuSign) require Fortify's OAuth app to be configured in our environment first — if you see 'not configured', contact us. AWS and Okta use API keys you generate in those providers' admin consoles; the connect form walks you through the minimum read-only IAM policy you should grant.",
  },
  {
    q: "How are integration credentials stored?",
    a: "Encrypted at rest via a KMS-backed helper. The symmetric key lives in our application environment (not in the database). A database CHECK constraint prevents any integration from being marked 'connected' without an encrypted credentials blob — i.e., the storage of plaintext credentials is structurally impossible.",
  },
  {
    q: "How do I upload evidence for a manual-review control?",
    a: "Open /app/compliance, expand the control, and use the file picker. Fortify scans uploads for obvious PHI patterns and rejects matches before persisting — the warning at every upload point is your defensible layer of customer notice.",
  },
  {
    q: "What gets included in a generated attestation?",
    a: "/app/attestations → Generate. The HIPAA SRA or SOC 2 readiness report includes: per-framework readiness percentage, the full control inventory with status, identified risks (non-compliant + partial controls), safeguards verified in place, vendor + BAA standing, workforce exclusion-screening summary, evidence summary, framework coverage map, and per-control source citations. The document is sha256-anchored and immutable once signed.",
  },
  {
    q: "How do I export an attestation as PDF?",
    a: "Open the attestation, click Print, and your browser's Print dialog will generate a PDF. The page is letter-sized and styled for print. Native PDF export is on the roadmap.",
  },
];

export default async function HelpPage() {
  const session = await getAppSession();
  assertActive(session);

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Support"
        title="Help center"
        description="Answers to the questions practices ask most often. If your question isn't here, write to us — we read every message."
      />

      <Card variant="raised" className="mb-8">
        <CardBody>
          <p className="text-sm text-[var(--color-secondary)] mb-3">
            <strong className="text-[var(--color-primary)]">Direct support:</strong>{" "}
            <a href="mailto:support@fortifynow.xyz" className="text-[var(--color-accent)] hover:text-[var(--color-primary)]">
              support@fortifynow.xyz
            </a>
          </p>
          <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">
            For security or compliance questions involving how Fortify is architected, write to{" "}
            <a href="mailto:security@fortifynow.xyz" className="text-[var(--color-accent)] hover:text-[var(--color-primary)]">
              security@fortifynow.xyz
            </a>{" "}
            — we&apos;ll arrange a call with our engineering team. Public architecture review is at{" "}
            <a href="/architecture" className="text-[var(--color-accent)] hover:text-[var(--color-primary)]">
              /architecture
            </a>.
          </p>
        </CardBody>
      </Card>

      <div className="mb-6">
        <NoPhiWarning variant="compact" />
      </div>

      <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-4">
        Frequently asked
      </h2>

      <div className="space-y-2">
        {FAQS.map((faq, idx) => (
          <Card key={idx}>
            <details className="group">
              <summary className="px-5 py-4 cursor-pointer text-sm text-[var(--color-primary)] font-medium hover:bg-[var(--color-surface-raised)] transition-colors list-none flex items-center justify-between gap-3">
                <span>{faq.q}</span>
                <span className="font-mono text-xs text-[var(--color-quaternary)] group-open:rotate-180 transition-transform">⌃</span>
              </summary>
              <div className="px-5 pb-5 pt-1 text-[13px] text-[var(--color-secondary)] leading-relaxed border-t border-[var(--color-border-subtle)]">
                {faq.a}
              </div>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
