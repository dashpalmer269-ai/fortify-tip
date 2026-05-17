import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";

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
      "Verify MFA enforcement, audit-log status, and BitLocker on managed devices. Required scopes: User.Read.All, AuditLog.Read.All, Reports.Read.All, DeviceManagementManagedDevices.Read.All.",
    connect_path: "/api/integrations/m365/connect",
    available: true,
    env_required: ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_REDIRECT_URI"],
  },
  {
    key: "aws",
    label: "AWS",
    description: "Pull encryption-at-rest, IAM MFA, CloudTrail config. Coming soon.",
    connect_path: null,
    available: false,
  },
  {
    key: "datto",
    label: "Datto",
    description: "Backup health and restore-test attestations. Coming soon.",
    connect_path: null,
    available: false,
  },
  {
    key: "okta",
    label: "Okta",
    description: "Workforce SSO posture + access reviews. Coming soon.",
    connect_path: null,
    available: false,
  },
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
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Automated evidence</p>
        <h1 className="text-3xl font-bold text-white">Integrations</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-2xl">
          Connect your environment to let Fortify collect compliance evidence automatically. Each integration powers one or more evidence checks across the control library.
        </p>
      </div>

      {params.connected && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-300">
          {params.connected} connected successfully.
        </div>
      )}
      {params.error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          Connection failed: {decodeURIComponent(params.error)}
        </div>
      )}

      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const c = byType.get(p.key);
          const connected = c?.status === "connected";
          return (
            <div
              key={p.key}
              className="glass-card rounded-2xl p-5"
              style={connected ? { boxShadow: "0 0 18px rgba(16,185,129,0.18)" } : undefined}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-semibold">{p.label}</h3>
                    {connected ? (
                      <span className="text-[10px] uppercase tracking-wider text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/15">
                        Connected
                      </span>
                    ) : !p.available ? (
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 px-2 py-0.5 rounded-full bg-gray-500/15">
                        Coming soon
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/15">
                        Available
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">{p.description}</p>
                  {p.env_required && !connected && (
                    <p className="text-[10px] text-gray-600 mt-2 font-mono">
                      Requires env: {p.env_required.join(", ")}
                    </p>
                  )}
                  {c?.last_error && (
                    <p className="text-xs text-red-400 mt-2">{c.last_error}</p>
                  )}
                  {c?.last_synced_at && (
                    <p className="text-[10px] text-gray-600 mt-2">
                      Last synced {new Date(c.last_synced_at).toLocaleString("en-US")}
                    </p>
                  )}
                </div>
                {p.available && p.connect_path && !connected && (
                  <Link
                    href={p.connect_path}
                    className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors shrink-0"
                    style={{ boxShadow: "0 0 18px rgba(139,92,246,0.4)" }}
                  >
                    Connect →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
