import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import NoPhiWarning from "@/components/ui/NoPhiWarning";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import {
  scoreIntegrationCredentials,
  type CredentialScore,
} from "@/lib/security/credential-scoring";
import AwsConnectForm from "./AwsConnectForm";
import CredentialHealthCard from "./CredentialHealthCard";
import { INTEGRATION_GUIDANCE } from "@/lib/integrations/setup-guidance";

export const dynamic = "force-dynamic";

interface IntegrationRow {
  integration_type: string;
  status: string;
  display_name: string | null;
  external_account_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  encrypted_credentials_bytes: string | null;
  scopes: string[] | null;
}

type ProviderCategory = "identity" | "cloud_infra" | "backup" | "ehr_pms" | "rmm_msp" | "signing" | "task_tracker";

interface Provider {
  key: string;
  label: string;
  description: string;
  category: ProviderCategory;
  connect_path: string | null;
  inline_form: "aws" | null;
  status: "available" | "scaffold" | "coming_soon";
  env_required?: string[];
}

const CATEGORY_META: Record<ProviderCategory, { label: string; description: string }> = {
  identity: {
    label: "Identity",
    description: "MFA enforcement, admin inventory, inactive accounts, audit logs.",
  },
  cloud_infra: {
    label: "Cloud infrastructure",
    description: "Public exposure, encryption, audit logging, key hygiene.",
  },
  backup: {
    label: "Backup & DR",
    description: "Successful runs, failure alerting, encryption, restore tests.",
  },
  ehr_pms: {
    label: "EHR / Practice Management",
    description: "Vendor risk + BAA + audit-log availability. Fortify never stores or pulls PHI.",
  },
  rmm_msp: {
    label: "RMM / MSP tooling",
    description: "Device inventory, patch status, anti-malware, encryption, last check-in.",
  },
  signing: {
    label: "E-signature",
    description: "Signed policies, BAAs, attestations — proof of completion.",
  },
  task_tracker: {
    label: "Task tracker",
    description: "Sync remediation work across compliance and engineering systems.",
  },
};

const PROVIDERS: Provider[] = [
  // Identity
  {
    key: "microsoft_365",
    label: "Microsoft 365 / Entra",
    description:
      "MFA, admin inventory, inactive users, risky guests, mailbox forwarding rules, security defaults, audit log, BitLocker.",
    category: "identity",
    connect_path: "/api/integrations/m365/connect",
    inline_form: null,
    status: "available",
    env_required: ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_REDIRECT_URI"],
  },
  {
    key: "google_workspace",
    label: "Google Workspace",
    description:
      "2-step verification, admin inventory, inactive users, external sharing, audit logs.",
    category: "identity",
    connect_path: "/api/integrations/google/connect",
    inline_form: null,
    status: "available",
    env_required: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  },
  {
    key: "okta",
    label: "Okta",
    description:
      "MFA policy, admin roles, inactive users, password policy, system log.",
    category: "identity",
    connect_path: "/api/integrations/okta/connect",
    inline_form: null,
    status: "available",
  },

  // Cloud infrastructure
  {
    key: "aws",
    label: "AWS",
    description:
      "CloudTrail, GuardDuty, root + IAM MFA, S3 public exposure + encryption, security groups, unused access keys.",
    category: "cloud_infra",
    connect_path: null,
    inline_form: "aws",
    status: "available",
  },

  // Backup & DR
  { key: "datto",        label: "Datto",          description: "Backup health + restore tests.", category: "backup", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "acronis",      label: "Acronis",        description: "Backup runs + encryption + restore tests.", category: "backup", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "cove_nable",   label: "Cove / N-able",  description: "Backup runs + failure alerts.", category: "backup", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "veeam",        label: "Veeam",          description: "Backup health + DR readiness.", category: "backup", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "azure_backup", label: "Azure Backup",   description: "Backup runs + retention attestation.", category: "backup", connect_path: null, inline_form: null, status: "scaffold" },

  // EHR / PMS (NO PHI)
  { key: "athenahealth", label: "Athenahealth",   description: "Vendor risk + BAA + admin review. No PHI.", category: "ehr_pms", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "advancedmd",   label: "AdvancedMD",     description: "Vendor risk + BAA + admin review. No PHI.", category: "ehr_pms", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "dentrix",      label: "Dentrix",        description: "Vendor risk + BAA + admin review. No PHI.", category: "ehr_pms", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "kareo_tebra",  label: "Kareo / Tebra",  description: "Vendor risk + BAA + admin review. No PHI.", category: "ehr_pms", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "drchrono",     label: "DrChrono",       description: "Vendor risk + BAA + admin review. No PHI.", category: "ehr_pms", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "ehr_other",    label: "Other EHR / PMS", description: "Attest a different EHR vendor.", category: "ehr_pms", connect_path: null, inline_form: null, status: "scaffold" },

  // RMM / MSP
  { key: "ninjaone",            label: "NinjaOne",            description: "Device inventory + patch + AV.", category: "rmm_msp", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "connectwise_automate", label: "ConnectWise Automate", description: "Device inventory + patch + AV.", category: "rmm_msp", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "datto_rmm",           label: "Datto RMM",           description: "Device inventory + patch + AV.", category: "rmm_msp", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "atera",               label: "Atera",               description: "Device inventory + patch + AV.", category: "rmm_msp", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "syncro",              label: "Syncro",              description: "Device inventory + patch + AV.", category: "rmm_msp", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "nable_rmm",           label: "N-able RMM",          description: "Device inventory + patch + AV.", category: "rmm_msp", connect_path: null, inline_form: null, status: "scaffold" },

  // Signing
  {
    key: "docusign",
    label: "DocuSign",
    description: "Signed policies, BAAs, attestations. Compliance envelopes scanned weekly.",
    category: "signing",
    connect_path: "/api/integrations/docusign/connect",
    inline_form: null,
    status: "available",
    env_required: ["DOCUSIGN_INTEGRATION_KEY", "DOCUSIGN_SECRET_KEY", "DOCUSIGN_REDIRECT_URI"],
  },
  { key: "dropbox_sign", label: "Dropbox Sign", description: "Signed compliance documents.", category: "signing", connect_path: null, inline_form: null, status: "scaffold" },

  // Task tracker
  { key: "jira",   label: "Jira",   description: "Sync remediation tickets.", category: "task_tracker", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "linear", label: "Linear", description: "Sync remediation issues.",  category: "task_tracker", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "asana",  label: "Asana",  description: "Sync remediation tasks.",   category: "task_tracker", connect_path: null, inline_form: null, status: "scaffold" },
  { key: "trello", label: "Trello", description: "Sync remediation cards.",   category: "task_tracker", connect_path: null, inline_form: null, status: "scaffold" },
];

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await getAppSession();
  assertActive(session);
  const params = await searchParams;

  const supabase = await createAuthedServerClient();
  const { data: connections } = await supabase
    .from("integrations")
    .select(
      "integration_type, status, display_name, external_account_id, last_synced_at, last_error, encrypted_credentials_bytes, scopes"
    )
    .eq("practice_id", session.membership.practice_id);
  const byType = new Map<string, IntegrationRow>(
    (connections ?? []).map((c) => [c.integration_type, c as IntegrationRow])
  );

  const scoreByType = new Map<string, CredentialScore>();
  for (const [type, integ] of byType) {
    if (integ.status === "connected") {
      scoreByType.set(
        type,
        scoreIntegrationCredentials({
          integration_type: integ.integration_type,
          status: integ.status,
          encrypted_credentials_bytes: integ.encrypted_credentials_bytes,
          last_synced_at: integ.last_synced_at,
          scopes: integ.scopes,
        })
      );
    }
  }

  const grouped: Record<ProviderCategory, Provider[]> = {
    identity: [],
    cloud_infra: [],
    backup: [],
    ehr_pms: [],
    rmm_msp: [],
    signing: [],
    task_tracker: [],
  };
  for (const p of PROVIDERS) grouped[p.category].push(p);

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Automated evidence"
        title="Integrations"
        description="Connect your environment so Fortify collects compliance evidence on a schedule. Every integration produces evidence + findings + tasks + dashboard updates + audit-log entries via the unified evidence flow. Credentials sealed via the KMS helper — no plaintext storage."
      />

      <div className="mb-5">
        <NoPhiWarning />
      </div>

      {params.connected && (
        <Card variant="raised" className="mb-5 px-4 py-3">
          <p className="text-sm text-[var(--color-success)]">{params.connected} connected successfully.</p>
        </Card>
      )}
      {params.error && (
        <Card variant="raised" className="mb-5 px-4 py-3">
          <p className="text-sm text-[var(--color-danger)]">
            Connection failed: {decodeURIComponent(params.error)}
          </p>
        </Card>
      )}

      {(Object.keys(grouped) as ProviderCategory[]).map((cat) => {
        const providers = grouped[cat];
        if (providers.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const connectedInCat = providers.filter((p) => byType.get(p.key)?.status === "connected").length;
        return (
          <section key={cat} className="mb-8">
            <div className="mb-3 flex items-baseline gap-3 px-1">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--color-secondary)]">
                {meta.label}
              </h2>
              <span className="font-mono text-[10px] text-[var(--color-quaternary)]">
                {connectedInCat} of {providers.length} connected
              </span>
            </div>
            <p className="text-xs text-[var(--color-tertiary)] mb-3 px-1">{meta.description}</p>

            <div className="space-y-px">
              {providers.map((p) => {
                const c = byType.get(p.key);
                const connected = c?.status === "connected";
                const score = scoreByType.get(p.key) ?? null;
                return (
                  <Card key={p.key}>
                    <div className="px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className="text-[var(--color-primary)] font-medium text-sm">{p.label}</h3>
                            {connected ? (
                              <Badge variant="success">Connected</Badge>
                            ) : p.status === "available" ? (
                              <Badge variant="accent">Available</Badge>
                            ) : p.status === "scaffold" ? (
                              <Badge variant="muted">Manual attest</Badge>
                            ) : (
                              <Badge variant="muted">Coming soon</Badge>
                            )}
                            {c?.external_account_id && (
                              <span className="font-mono text-[10px] text-[var(--color-quaternary)]">
                                {c.external_account_id}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">{p.description}</p>
                          {p.env_required && !connected && (
                            <p className="text-[10px] text-[var(--color-quaternary)] mt-2 font-mono">
                              Requires env: {p.env_required.join(", ")}
                            </p>
                          )}
                          {c?.last_error && (
                            <p className="text-xs text-[var(--color-danger)] mt-2">{c.last_error}</p>
                          )}
                          {c?.last_synced_at && (
                            <p className="text-[10px] text-[var(--color-quaternary)] mt-2 font-mono">
                              Last synced {new Date(c.last_synced_at).toLocaleString("en-US")}
                            </p>
                          )}
                        </div>
                        {p.status === "available" && p.connect_path && !connected && (
                          <ButtonLink href={p.connect_path} variant="primary" size="sm">
                            Connect
                          </ButtonLink>
                        )}
                        {p.status === "available" && p.inline_form === "aws" && !connected && <AwsConnectForm />}
                      </div>

                      {connected && score && <CredentialHealthCard score={score} />}

                      {/* Guided "How to connect" — plain-language steps,
                          permissions, what we check, evidence produced. */}
                      <IntegrationGuidancePanel providerKey={p.key} connected={connected} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Expandable guided-setup panel. Native <details> so it stays a server
 * component (no client JS). Renders nothing for providers without
 * guidance content.
 */
function IntegrationGuidancePanel({
  providerKey,
  connected,
}: {
  providerKey: string;
  connected: boolean;
}) {
  const g = INTEGRATION_GUIDANCE[providerKey];
  if (!g) return null;

  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider text-violet-400 hover:text-violet-300 transition-colors">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>
        {connected ? "What Fortify checks here" : "How to connect"}
        <span className="text-[var(--color-quaternary)] normal-case tracking-normal">· {g.timeEstimate}</span>
      </summary>

      <div className="mt-3 pl-4 border-l border-[var(--color-border-subtle)] space-y-4 text-[13px]">
        <p className="text-[var(--color-secondary)] leading-relaxed">{g.summary}</p>

        {!connected && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)] mb-1.5">
              Steps
            </p>
            <ol className="space-y-1.5 list-none">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-[var(--color-secondary)] leading-relaxed">
                  <span className="font-mono text-[11px] text-violet-400 shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)] mb-1.5">
            Access you&apos;re granting
          </p>
          <p className="text-[var(--color-secondary)] leading-relaxed">{g.permissions}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)] mb-1.5">
              What Fortify checks
            </p>
            <ul className="space-y-1">
              {g.whatWeCheck.map((w, i) => (
                <li key={i} className="flex gap-1.5 text-[var(--color-secondary)] leading-relaxed">
                  <span className="text-violet-400 shrink-0">·</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)] mb-1.5">
              Evidence it creates
            </p>
            <ul className="space-y-1">
              {g.evidenceCreated.map((e, i) => (
                <li key={i} className="flex gap-1.5 text-[var(--color-secondary)] leading-relaxed">
                  <span className="text-emerald-400 shrink-0">·</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </details>
  );
}
