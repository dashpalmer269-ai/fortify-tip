/**
 * Google Workspace Admin SDK client + evidence-check collectors.
 *
 * Enable by setting in Vercel:
 *   GOOGLE_CLIENT_ID     – OAuth 2.0 client ID (Google Cloud Console)
 *   GOOGLE_CLIENT_SECRET – client secret
 *   GOOGLE_REDIRECT_URI  – https://<domain>/api/integrations/google/callback
 *
 * Requires a Google Workspace super-admin to consent. The scopes below are
 * read-only Admin SDK Directory + Reports scopes.
 *
 * Until configured, isConfigured() returns false and collectors return
 * { status: "not_collected" } gracefully.
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const DIRECTORY_API = "https://admin.googleapis.com/admin/directory/v1";
const REPORTS_API = "https://admin.googleapis.com/admin/reports/v1";

export interface GoogleCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO
  customer_id?: string;
  scope?: string;
}

export interface CheckOutcome {
  status: "pass" | "fail" | "partial" | "not_collected" | "error";
  observed_value: unknown;
  raw: unknown;
}

const SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/admin.reports.audit.readonly",
  "openid",
  "email",
];

export function isConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

export function authorizationUrl(state: string): string {
  if (!isConfigured()) throw new Error("Google Workspace OAuth not configured");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // force refresh_token on every consent
    state,
  });
  return `${GOOGLE_AUTH}?${params}`;
}

export async function exchangeCode(code: string): Promise<GoogleCredentials> {
  if (!isConfigured()) throw new Error("Google Workspace OAuth not configured");
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error_description ?? "Google token exchange failed (no refresh_token — re-consent required)");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
    scope: json.scope,
  };
}

async function refreshIfExpired(creds: GoogleCredentials): Promise<GoogleCredentials> {
  if (new Date(creds.expires_at).getTime() > Date.now() + 60_000) return creds;
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) throw new Error("Google token refresh failed");
  return {
    ...creds,
    access_token: json.access_token,
    expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
  };
}

async function apiGet(creds: GoogleCredentials, url: string): Promise<unknown> {
  const fresh = await refreshIfExpired(creds);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${fresh.access_token}` } });
  if (!res.ok) throw new Error(`Google ${url} → HTTP ${res.status}`);
  return res.json();
}

interface DirectoryUser {
  primaryEmail: string;
  isAdmin?: boolean;
  isDelegatedAdmin?: boolean;
  isEnrolledIn2Sv?: boolean;
  isEnforcedIn2Sv?: boolean;
  suspended?: boolean;
}

/** Page through all users in the customer's directory. */
async function listAllUsers(creds: GoogleCredentials): Promise<DirectoryUser[]> {
  const users: DirectoryUser[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      customer: "my_customer",
      maxResults: "500",
      projection: "basic",
      fields: "users(primaryEmail,isAdmin,isDelegatedAdmin,isEnrolledIn2Sv,isEnforcedIn2Sv,suspended),nextPageToken",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const json = (await apiGet(creds, `${DIRECTORY_API}/users?${params}`)) as {
      users?: DirectoryUser[];
      nextPageToken?: string;
    };
    if (json.users) users.push(...json.users);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return users;
}

/** Check: 2-Step Verification enrolled for every admin account */
export async function checkAdmin2SvEnforced(creds: GoogleCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Google Workspace connection" } };
  try {
    const users = await listAllUsers(creds);
    const admins = users.filter((u) => (u.isAdmin || u.isDelegatedAdmin) && !u.suspended);
    if (admins.length === 0) {
      return { status: "not_collected", observed_value: { reason: "no admin accounts found" }, raw: null };
    }
    const enrolled = admins.filter((u) => u.isEnrolledIn2Sv);
    const missing = admins.filter((u) => !u.isEnrolledIn2Sv);
    return {
      status: missing.length === 0 ? "pass" : enrolled.length === 0 ? "fail" : "partial",
      observed_value: {
        total_admins: admins.length,
        admins_with_2sv: enrolled.length,
        admins_missing_2sv: missing.length,
        admins_missing_2sv_emails: missing.map((u) => u.primaryEmail).slice(0, 20),
      },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/** Check: 2-Step Verification enrolled across all active users */
export async function checkAll2SvEnrolled(creds: GoogleCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Google Workspace connection" } };
  try {
    const users = (await listAllUsers(creds)).filter((u) => !u.suspended);
    if (users.length === 0) {
      return { status: "not_collected", observed_value: { reason: "no active users" }, raw: null };
    }
    const enrolled = users.filter((u) => u.isEnrolledIn2Sv).length;
    return {
      status: enrolled === users.length ? "pass" : enrolled === 0 ? "fail" : "partial",
      observed_value: {
        total_active_users: users.length,
        users_with_2sv: enrolled,
        percentage: Math.round((enrolled / users.length) * 100),
      },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/** Check: admin audit log accessible and producing events */
export async function checkAuditLogAccessible(creds: GoogleCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Google Workspace connection" } };
  try {
    const json = (await apiGet(
      creds,
      `${REPORTS_API}/activity/users/all/applications/admin?maxResults=1`
    )) as { items?: Array<unknown> };
    const count = json.items?.length ?? 0;
    return {
      status: count > 0 ? "pass" : "fail",
      observed_value: { sample_event_count: count },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}
