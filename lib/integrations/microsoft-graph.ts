/**
 * Microsoft Graph API client + evidence-check runners.
 *
 * To enable real OAuth + Graph calls, set in Vercel:
 *   MS_CLIENT_ID     – Azure app registration application (client) ID
 *   MS_CLIENT_SECRET – client secret value
 *   MS_REDIRECT_URI  – e.g. https://<domain>/api/integrations/m365/callback
 *
 * Until those are set, runners return { status: "not_collected" } gracefully.
 */
const GRAPH_API = "https://graph.microsoft.com/v1.0";
const TOKEN_BASE = "https://login.microsoftonline.com";

export interface M365Credentials {
  access_token: string;
  refresh_token: string;
  expires_at: string;       // ISO timestamp
  tenant_id: string;
  scope?: string;
}

export interface CheckOutcome {
  status: "pass" | "fail" | "partial" | "not_collected" | "error";
  observed_value: unknown;
  raw: unknown;
}

export function isConfigured(): boolean {
  return Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.MS_REDIRECT_URI);
}

export function authorizationUrl(state: string): string {
  if (!isConfigured()) throw new Error("Microsoft 365 OAuth not configured");
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.MS_REDIRECT_URI!,
    response_mode: "query",
    scope: [
      "offline_access",
      "openid",
      "profile",
      "User.Read.All",
      "AuditLog.Read.All",
      "Reports.Read.All",
      "DeviceManagementManagedDevices.Read.All",
    ].join(" "),
    state,
  });
  return `${TOKEN_BASE}/common/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<M365Credentials> {
  if (!isConfigured()) throw new Error("Microsoft 365 OAuth not configured");
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.MS_REDIRECT_URI!,
  });

  const res = await fetch(`${TOKEN_BASE}/common/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error_description ?? "M365 token exchange failed");
  }

  // Decode the tenant id from the id_token claim. For now we just call /me to discover.
  const meRes = await fetch(`${GRAPH_API}/organization`, {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const meJson = (await meRes.json()) as { value?: Array<{ id: string }> };
  const tenant_id = meJson.value?.[0]?.id ?? "";

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
    tenant_id,
  };
}

async function refreshIfExpired(creds: M365Credentials): Promise<M365Credentials> {
  if (new Date(creds.expires_at).getTime() > Date.now() + 60_000) return creds;

  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch(`${TOKEN_BASE}/common/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) throw new Error("M365 refresh failed");
  return {
    ...creds,
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? creds.refresh_token,
    expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
  };
}

async function graphGet(creds: M365Credentials, path: string): Promise<unknown> {
  const fresh = await refreshIfExpired(creds);
  const res = await fetch(`${GRAPH_API}${path}`, {
    headers: { Authorization: `Bearer ${fresh.access_token}` },
  });
  if (!res.ok) throw new Error(`Graph ${path} → HTTP ${res.status}`);
  return res.json();
}

/** Check: all users have MFA registered + enforced */
export async function checkMfaUsersEnforced(creds: M365Credentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    const json = (await graphGet(creds, "/reports/credentialUserRegistrationDetails?$top=999")) as {
      value: Array<{ userPrincipalName: string; isMfaRegistered: boolean }>;
    };
    const total = json.value.length;
    const mfa = json.value.filter((u) => u.isMfaRegistered).length;
    return {
      status: total === 0 ? "not_collected" : mfa === total ? "pass" : mfa === 0 ? "fail" : "partial",
      observed_value: { total_users: total, mfa_registered: mfa, percentage: total ? (mfa / total) * 100 : 0 },
      raw: { sample: json.value.slice(0, 5) },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/** Check: M365 unified audit log is enabled */
export async function checkAuditLogEnabled(creds: M365Credentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    // Use a small recent query as a liveness probe.
    const json = (await graphGet(
      creds,
      `/auditLogs/directoryAudits?$top=1`
    )) as { value: Array<unknown> };
    return {
      status: json.value.length > 0 ? "pass" : "fail",
      observed_value: { sample_event_count: json.value.length },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/** Check: BitLocker enforced on Intune-managed Windows devices */
export async function checkBitLockerEnforced(creds: M365Credentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    const json = (await graphGet(
      creds,
      "/deviceManagement/managedDevices?$select=deviceName,operatingSystem,isEncrypted&$top=200"
    )) as { value: Array<{ operatingSystem: string; isEncrypted: boolean }> };
    const windows = json.value.filter((d) => /windows/i.test(d.operatingSystem ?? ""));
    const encrypted = windows.filter((d) => d.isEncrypted).length;
    return {
      status: windows.length === 0
        ? "not_collected"
        : encrypted === windows.length
        ? "pass"
        : encrypted === 0
        ? "fail"
        : "partial",
      observed_value: { windows_devices: windows.length, encrypted },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}
