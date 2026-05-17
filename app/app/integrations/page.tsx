import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

interface IntegrationRow {
  integration_type: string;
  status: string;
  display_name: string | null;
  external_account_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
}

const PROVIDERS: Array<{
  key: string;
  label: string;
  description: string;
  connect_path: string | null;
  available: boolean;
  env_required?: string[];
}> = [
  {
    key: "microsoft_365",
    label: "Microsoft 365",
    description:
      "Verify MFA enforcement, audit-log status, and BitLocker on managed devices.",
    connect_path: "/api/integrations/m365/connect",
    available: true,
    env_required: ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_REDIRECT_URI"],
  },
  { key: "aws", label: "AWS", description: "Pull encryption-at-rest, IAM MFA, CloudTrail config.", connect_path: null, available: false },
  { key: "datto", label: "Datto", description: "Backup health and restore-test attestations.", connect_path: null, available: false },
  { key: "okta", label: "Okta", description: "Workforce SSO posture + access reviews.", connect_path: null, available: false },
];

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");
  const params = await searchParams;

  const supabase = await createAuthedServerClient();
  const { data: connections } = await supabase
    .from("integrations")
    .select("integration_type, status, display_name, external_account_id, last_synced_at, last_error")
    .eq("practice_id", session.membership.practice_id);
  const byType = new Map<string, IntegrationRow>(
    (connections ?? []).map((c) => [c.integration_type, c as IntegrationRow])
  );

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Automated evidence"
        title="Integrations"
        description="Connect your environment so Fortify collects compliance evidence on a schedule. Each integration powers one or more evidence checks across the control library."
      />

      {params.connected && (
        <Card variant="raised" className="mb-5 px-4 py-3">
          <p className="text-sm text-[var(--color-success)]">{params.connected} connected successfully.</p>
        </Card>
      )}
      {params.error && (
        <Card variant="raised" className="mb-5 px-4 py-3">
          <p className="text-sm text-[var(--color-danger)]">Connection failed: {decodeURIComponent(params.error)}</p>
        </Card>
      )}

      <div className="space-y-px">
        {PROVIDERS.map((p) => {
          const c = byType.get(p.key);
          const connected = c?.status === "connected";
          return (
            <Card key={p.key}>
              <div className="px-5 py-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[var(--color-primary)] font-medium text-sm">{p.label}</h3>
                    {connected
                      ? <Badge variant="success">Connected</Badge>
                      : !p.available
                      ? <Badge variant="muted">Coming soon</Badge>
                      : <Badge variant="accent">Available</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">{p.description}</p>
                  {p.env_required && !connected && (
                    <p className="text-[10px] text-[var(--color-quaternary)] mt-2 font-mono">
                      Requires env: {p.env_required.join(", ")}
                    </p>
                  )}
                  {c?.last_error && <p className="text-xs text-[var(--color-danger)] mt-2">{c.last_error}</p>}
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
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
