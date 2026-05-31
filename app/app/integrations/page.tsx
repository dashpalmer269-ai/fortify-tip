import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import {
  scoreIntegrationCredentials,
  type CredentialScore,
} from "@/lib/security/credential-scoring";
import AwsConnectForm from "./AwsConnectForm";
import CredentialHealthCard from "./CredentialHealthCard";

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

const PROVIDERS: Array<{
  key: string;
  label: string;
  description: string;
  connect_path: string | null;
  inline_form: "aws" | null;
  available: boolean;
  env_required?: string[];
}> = [
  {
    key: "microsoft_365",
    label: "Microsoft 365",
    description:
      "Verify MFA enforcement, audit-log status, and BitLocker on managed devices.",
    connect_path: "/api/integrations/m365/connect",
    inline_form: null,
    available: true,
    env_required: ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_REDIRECT_URI"],
  },
  {
    key: "google_workspace",
    label: "Google Workspace",
    description:
      "Verify 2-step verification enrollment for admins + all users, audit-log access.",
    connect_path: "/api/integrations/google/connect",
    inline_form: null,
    available: true,
    env_required: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  },
  {
    key: "okta",
    label: "Okta",
    description: "Workforce SSO MFA policy, admin MFA, system log accessibility.",
    connect_path: "/api/integrations/okta/connect",
    inline_form: null,
    available: true,
  },
  {
    key: "aws",
    label: "AWS",
    description:
      "CloudTrail multi-region logging, root + IAM user MFA, S3 public-access exposure, S3 default encryption.",
    connect_path: null,
    inline_form: "aws",
    available: true,
  },
  {
    key: "datto",
    label: "Datto",
    description: "Backup health and restore-test attestations.",
    connect_path: null,
    inline_form: null,
    available: false,
  },
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

  // Pre-compute credential scores server-side so the client component
  // doesn't need to import the scoring logic or know the integration shape.
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

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Automated evidence"
        title="Integrations"
        description="Connect your environment so Fortify collects compliance evidence on a schedule. Each integration powers one or more evidence checks across the control library. Credentials are sealed via the KMS helper — no plaintext storage."
      />

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

      <div className="space-y-px">
        {PROVIDERS.map((p) => {
          const c = byType.get(p.key);
          const connected = c?.status === "connected";
          const score = scoreByType.get(p.key) ?? null;
          return (
            <Card key={p.key}>
              <div className="px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-[var(--color-primary)] font-medium text-sm">{p.label}</h3>
                      {connected ? (
                        <Badge variant="success">Connected</Badge>
                      ) : !p.available ? (
                        <Badge variant="muted">Coming soon</Badge>
                      ) : (
                        <Badge variant="accent">Available</Badge>
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
                  {p.available && p.connect_path && !connected && (
                    <ButtonLink href={p.connect_path} variant="primary" size="sm">
                      Connect
                    </ButtonLink>
                  )}
                  {p.available && p.inline_form === "aws" && !connected && <AwsConnectForm />}
                </div>

                {/* Credential health card — only for connected integrations */}
                {connected && score && <CredentialHealthCard score={score} />}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
