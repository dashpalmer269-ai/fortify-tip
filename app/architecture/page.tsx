import Link from "next/link";

export const metadata = {
  title: "Architecture — No PHI by design | Fortify",
  description:
    "Public architecture review of how Fortify is engineered to never receive, store, or transmit Protected Health Information.",
};

/**
 * Public architecture-review page intended for prospective customers'
 * security officers + privacy officers + auditors. Linkable directly
 * (no auth required) so it can be sent in sales cycles and embedded in
 * vendor-onboarding paperwork.
 *
 * The four-layer NO-PHI enforcement that the page documents is real and
 * auditable — every claim corresponds to a file in this repo.
 */
export default function ArchitectureReviewPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-xs text-gray-500 hover:text-white">
          ← Back to Fortify
        </Link>

        <header className="mt-6 mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-violet-400 mb-2">
            Architecture review · v1
          </p>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Fortify is engineered to never touch PHI.
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed">
            This document explains, in plain language, how Fortify is built so
            it cannot receive, store, or transmit Protected Health Information.
            Written for the security officer / privacy officer / compliance
            officer evaluating Fortify for use in their practice.
          </p>
        </header>

        <article className="prose-doc">
          <section>
            <h2>1. What Fortify is — and is not</h2>
            <p>
              Fortify is a compliance-management platform. It tracks whether your
              practice&apos;s clinical systems, identity providers, and operational
              processes are configured the way HIPAA, SOC 2, ISO 27001, and GDPR
              require. The actual clinical work — the EHR, the practice-management
              system, the billing clearinghouse — stays where it lives today.
              Fortify is the layer that watches the configuration, not the layer
              that stores the patient data.
            </p>
            <p>
              <strong>Fortify is not a Business Associate under HIPAA.</strong>{" "}
              That distinction is intentional and structural. We do not need a
              Business Associate Agreement with you because we do not handle
              Protected Health Information on your behalf.
            </p>
          </section>

          <section>
            <h2>2. The no-PHI invariant — four enforcement layers</h2>
            <p>
              &ldquo;We don&apos;t want PHI&rdquo; is a policy. &ldquo;We can&apos;t accept PHI&rdquo; is an
              architecture. Fortify treats it as the latter, enforced at four
              independent layers so a bug at any single layer does not breach the
              guarantee.
            </p>

            <h3>Layer 1 — AI prompt firewall</h3>
            <p>
              Every call to the language-model provider includes a system prompt
              (<code>NO_PHI_AI_SYSTEM_PROMPT</code>) explicitly instructing the
              model to refuse any input that contains identifiable patient
              information and to never echo such data back. Fortify&apos;s prompts to
              the model carry only compliance metadata: control names, framework
              citations, integration scan results, control statuses.
            </p>

            <h3>Layer 2 — API schema gate</h3>
            <p>
              Every API endpoint that accepts free-text input passes the body
              through a PHI-pattern scanner before any database write. The
              scanner looks for SSN patterns, MRN labels, date-of-birth labels,
              ICD-10 diagnosis codes, and other obvious PHI signals. A match
              returns a 422 with a clear rejection message — the request never
              reaches the database.
            </p>

            <h3>Layer 3 — Database CHECK constraint</h3>
            <p>
              Every multi-tenant table that could conceivably store text fields
              carries a Postgres CHECK constraint (<code>_no_phi_check</code>) at
              the schema level. A row that contains a recognized PHI pattern is
              rejected by the database itself, regardless of which application
              code attempted the write or with what privileges.
            </p>

            <h3>Layer 4 — UI surfaces</h3>
            <p>
              Every page where a workforce member can upload a file, paste text,
              or write a note displays a persistent NO-PHI badge and a red
              warning at the point of action. The customer is reminded — every
              time — that this platform is not configured to receive Protected
              Health Information.
            </p>
          </section>

          <section>
            <h2>3. What Fortify does store</h2>
            <p>Compliance-program metadata only:</p>
            <ul>
              <li>Control library content (framework citations, mappings, remediation guidance)</li>
              <li>The practice&apos;s self-asserted posture against each control (compliant / partial / non-compliant)</li>
              <li>Evidence-collection results: integration scan outputs (e.g. &ldquo;MFA enrollment 96%&rdquo;), document upload paths, attestation timestamps</li>
              <li>Workforce membership: name, email, role, employment dates</li>
              <li>OIG LEIE exclusion-screening results (workforce members only, never patients)</li>
              <li>Audit logs of every privileged action within the platform</li>
              <li>Encrypted integration credentials (OAuth tokens, API keys), sealed via a KMS-backed helper with the symmetric key held outside the database</li>
            </ul>
          </section>

          <section>
            <h2>4. What Fortify never stores</h2>
            <ul>
              <li>Patient names, addresses, phone numbers, dates of birth, ages over 89</li>
              <li>Medical record numbers, account numbers, health plan beneficiary numbers</li>
              <li>Diagnoses, treatment notes, medication lists, lab results, imaging</li>
              <li>Billing line-items, insurance claim contents</li>
              <li>Any of the 18 HIPAA Safe Harbor identifiers</li>
            </ul>
          </section>

          <section>
            <h2>5. Subprocessor list</h2>
            <p>
              Because Fortify does not store PHI, none of our subprocessors are
              HIPAA Business Associates of yours. They are infrastructure
              vendors providing standard SaaS services:
            </p>
            <ul>
              <li><strong>Supabase</strong> — Postgres database + authentication + object storage. Hosts compliance metadata only.</li>
              <li><strong>Vercel</strong> — Application hosting + serverless functions + cron.</li>
              <li><strong>Anthropic (Claude)</strong> — Language-model API for compliance narrative generation. Receives only compliance metadata, never PHI (enforced by Layer 1 above).</li>
              <li><strong>Stripe</strong> — Billing only. Never receives patient data.</li>
              <li><strong>Resend</strong> — Transactional email (workforce notifications, task reminders).</li>
            </ul>
          </section>

          <section>
            <h2>6. Customer responsibility</h2>
            <p>
              The architectural guarantees above hold as long as customers do
              not deliberately attempt to upload PHI to Fortify. The Customer
              Agreement explicitly requires that customers not upload PHI; the
              point-of-action warnings reinforce this; the API and database
              gates reject obvious cases. A determined customer could still
              defeat the gates (e.g., by uploading an encrypted file containing
              PHI under an innocuous filename). That risk sits with the
              customer — not with Fortify — and is the structural reason
              Fortify is not a Business Associate.
            </p>
          </section>

          <section>
            <h2>7. Verifying these claims</h2>
            <p>
              Every claim in this document corresponds to source code in
              Fortify&apos;s repository. Specifically:
            </p>
            <ul>
              <li>Layer 1: <code>lib/compliance/no-phi.ts</code> — <code>NO_PHI_AI_SYSTEM_PROMPT</code></li>
              <li>Layer 2: <code>lib/schemas/api.ts</code> — <code>scanFieldsForPhi</code></li>
              <li>Layer 3: <code>supabase/migrations/013_no_phi_invariant.sql</code> — table CHECK constraints</li>
              <li>Layer 4: <code>components/ui/NoPhiBadge.tsx</code>, <code>components/ui/NoPhiWarning.tsx</code></li>
              <li>Customer warnings: every form that accepts file upload or free text imports <code>NoPhiWarning</code></li>
              <li>Server-side upload scanner: <code>lib/compliance/phi-scanner.ts</code></li>
            </ul>
            <p>
              A read-only repository review under NDA is available to enterprise
              customers&apos; security teams. Contact <a href="mailto:security@fortifynow.xyz">security@fortifynow.xyz</a>.
            </p>
          </section>

          <footer className="mt-12 pt-6 border-t border-gray-900 text-xs text-gray-600">
            <p>
              Last reviewed {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}. This document
              is descriptive of Fortify&apos;s architecture as of this date — not a contractual representation.
              For contractual terms, see the Customer Agreement.
            </p>
          </footer>
        </article>

        <style>{`
          .prose-doc { color: #d4d4d8; }
          .prose-doc h2 { font-size: 22px; font-weight: 600; color: #fff; margin: 36px 0 12px; letter-spacing: -0.01em; }
          .prose-doc h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.12em; color: #a78bfa; margin: 24px 0 8px; font-weight: 500; }
          .prose-doc p  { font-size: 15px; line-height: 1.72; color: #d4d4d8; margin: 0 0 14px; }
          .prose-doc ul { margin: 8px 0 16px 22px; color: #d4d4d8; }
          .prose-doc li { font-size: 14px; line-height: 1.7; margin: 4px 0; }
          .prose-doc strong { color: #fff; font-weight: 600; }
          .prose-doc code { font-family: ui-monospace, Menlo, monospace; font-size: 13px; background: #1a1a2e; padding: 1px 6px; border-radius: 4px; color: #c4b5fd; }
          .prose-doc a { color: #a78bfa; text-decoration: underline; text-underline-offset: 2px; }
          .prose-doc a:hover { color: #fff; }
        `}</style>
      </div>
    </div>
  );
}
