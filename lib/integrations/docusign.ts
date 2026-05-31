/**
 * DocuSign integration. OAuth Authorization Code Grant flow.
 *
 * Env required for OAuth:
 *   DOCUSIGN_INTEGRATION_KEY  (Client ID)
 *   DOCUSIGN_SECRET_KEY
 *   DOCUSIGN_REDIRECT_URI
 *   DOCUSIGN_ENV              "demo" | "production" (defaults to production)
 *
 * Until those are set, runners return { status: "not_collected" }.
 *
 * NO PHI: this module reads envelope metadata (subject, status, recipients'
 * emails, completion timestamps) — never the envelope DOCUMENTS or their
 * extracted form fields. Healthcare practices using DocuSign for clinical
 * intake should keep that workflow OUT of the integration scope and only
 * use the integration for compliance artifacts (signed policies, BAAs,
 * attestations).
 */

const OAUTH_BASE = (env: string) =>
  env === "demo" ? "https://account-d.docusign.com" : "https://account.docusign.com";

export interface DocuSignCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_id: string;
  base_uri: string; // e.g. https://na3.docusign.net
  env: "demo" | "production";
}

export interface CheckOutcome {
  status: "pass" | "fail" | "partial" | "not_collected" | "error";
  observed_value: unknown;
  raw: unknown;
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.DOCUSIGN_INTEGRATION_KEY &&
      process.env.DOCUSIGN_SECRET_KEY &&
      process.env.DOCUSIGN_REDIRECT_URI
  );
}

function envSetting(): "demo" | "production" {
  return process.env.DOCUSIGN_ENV === "demo" ? "demo" : "production";
}

export function authorizationUrl(state: string): string {
  if (!isConfigured()) throw new Error("DocuSign OAuth not configured");
  const env = envSetting();
  const params = new URLSearchParams({
    response_type: "code",
    scope: "signature impersonation",
    client_id: process.env.DOCUSIGN_INTEGRATION_KEY!,
    redirect_uri: process.env.DOCUSIGN_REDIRECT_URI!,
    state,
  });
  return `${OAUTH_BASE(env)}/oauth/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<DocuSignCredentials> {
  if (!isConfigured()) throw new Error("DocuSign OAuth not configured");
  const env = envSetting();

  const basic = Buffer.from(
    `${process.env.DOCUSIGN_INTEGRATION_KEY}:${process.env.DOCUSIGN_SECRET_KEY}`
  ).toString("base64");

  const tokenRes = await fetch(`${OAUTH_BASE(env)}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token) {
    throw new Error(tokenJson.error_description ?? "DocuSign token exchange failed");
  }

  // Discover the user's default account + base URI
  const userInfoRes = await fetch(`${OAUTH_BASE(env)}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const userInfo = (await userInfoRes.json()) as {
    accounts?: Array<{ account_id: string; is_default: boolean; base_uri: string }>;
  };
  const acct = userInfo.accounts?.find((a) => a.is_default) ?? userInfo.accounts?.[0];
  if (!acct) throw new Error("DocuSign: no accessible account found");

  return {
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: new Date(Date.now() + (tokenJson.expires_in ?? 28800) * 1000).toISOString(),
    account_id: acct.account_id,
    base_uri: acct.base_uri,
    env,
  };
}

async function refreshIfExpired(creds: DocuSignCredentials): Promise<DocuSignCredentials> {
  if (new Date(creds.expires_at).getTime() - Date.now() > 60_000) return creds;

  const basic = Buffer.from(
    `${process.env.DOCUSIGN_INTEGRATION_KEY}:${process.env.DOCUSIGN_SECRET_KEY}`
  ).toString("base64");
  const res = await fetch(`${OAUTH_BASE(creds.env)}/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: creds.refresh_token }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !json.access_token) throw new Error("DocuSign refresh failed");
  return {
    ...creds,
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? creds.refresh_token,
    expires_at: new Date(Date.now() + (json.expires_in ?? 28800) * 1000).toISOString(),
  };
}

async function esignGet<T = unknown>(creds: DocuSignCredentials, path: string): Promise<T> {
  const fresh = await refreshIfExpired(creds);
  const url = `${fresh.base_uri}/restapi/v2.1/accounts/${fresh.account_id}${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${fresh.access_token}` } });
  if (!res.ok) throw new Error(`DocuSign ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Check: account accessible — basic health check that the integration's
 * token is still valid and the account is queryable. Passes when we can
 * read the account row.
 */
export async function checkAccountAccessible(creds: DocuSignCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no DocuSign connection" } };
  try {
    const acct = await esignGet<{ accountName?: string; accountIdGuid?: string }>(creds, "");
    return {
      status: "pass",
      observed_value: {
        account_name: acct.accountName ?? null,
        account_id: acct.accountIdGuid ?? null,
        env: creds.env,
      },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/**
 * Check: signed compliance envelopes — counts envelopes whose subject
 * matches compliance patterns (BAA, policy, attestation, agreement) and
 * have completed signing in the last `window_days`. Passes when at least
 * one signed envelope exists per practice expectation.
 */
export async function checkSignedComplianceEnvelopes(
  creds: DocuSignCredentials | null,
  windowDays: number = 365
): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no DocuSign connection" } };
  try {
    const from = new Date(Date.now() - windowDays * 86400_000).toISOString();
    type Envelope = { envelopeId: string; status: string; emailSubject?: string; completedDateTime?: string };
    const json = await esignGet<{ envelopes?: Envelope[] }>(
      creds,
      `/envelopes?from_date=${encodeURIComponent(from)}&status=completed&include=recipients`
    );
    const envs = json.envelopes ?? [];
    const complianceRegex = /\b(baa|business associate|policy|attestation|hipaa|compliance|agreement)\b/i;
    const signed = envs.filter((e) => complianceRegex.test(e.emailSubject ?? ""));

    return {
      status: signed.length > 0 ? "pass" : "fail",
      observed_value: {
        window_days: windowDays,
        total_completed_envelopes: envs.length,
        signed_compliance_envelopes: signed.length,
      },
      raw: { sample_subjects: signed.slice(0, 10).map((e) => e.emailSubject) },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/**
 * Check: outstanding compliance envelopes — counts envelopes still pending
 * signature past the configured age threshold. Passes when none are stale.
 */
export async function checkOutstandingEnvelopes(
  creds: DocuSignCredentials | null,
  maxAgeDays: number = 30
): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no DocuSign connection" } };
  try {
    const from = new Date(Date.now() - 365 * 86400_000).toISOString();
    type Envelope = { envelopeId: string; status: string; emailSubject?: string; sentDateTime?: string };
    const json = await esignGet<{ envelopes?: Envelope[] }>(
      creds,
      `/envelopes?from_date=${encodeURIComponent(from)}&status=sent,delivered`
    );
    const envs = json.envelopes ?? [];
    const cutoff = Date.now() - maxAgeDays * 86400_000;
    const stale = envs.filter((e) => {
      if (!e.sentDateTime) return false;
      return new Date(e.sentDateTime).getTime() < cutoff;
    });
    return {
      status: stale.length === 0 ? "pass" : "fail",
      observed_value: {
        total_outstanding: envs.length,
        stale_outstanding: stale.length,
        max_age_days: maxAgeDays,
      },
      raw: { stale_subjects: stale.slice(0, 10).map((e) => e.emailSubject) },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}
