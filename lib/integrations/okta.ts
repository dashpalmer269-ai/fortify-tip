/**
 * Okta client + evidence-check collectors.
 *
 * Okta connections bootstrap with an org URL + API token (SSWS), which is the
 * standard way admins grant read access without standing up an OAuth service
 * app. The token needs read scope on users, policies, and the system log
 * (a read-only admin role token covers all three).
 *
 * Credentials shape: { org_url, api_token }. Stored encrypted via
 * lib/security/credentials.
 */

export interface OktaCredentials {
  org_url: string; // e.g. https://acme.okta.com  (no trailing slash)
  api_token: string;
}

export interface CheckOutcome {
  status: "pass" | "fail" | "partial" | "not_collected" | "error";
  observed_value: unknown;
  raw: unknown;
}

function normalizeOrgUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function oktaGet(creds: OktaCredentials, path: string): Promise<{ json: unknown; res: Response }> {
  const res = await fetch(`${normalizeOrgUrl(creds.org_url)}${path}`, {
    headers: {
      Authorization: `SSWS ${creds.api_token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Okta ${path} → HTTP ${res.status}`);
  return { json: await res.json(), res };
}

/**
 * Validate a connection by hitting a cheap endpoint. Used by the connect
 * route to reject bad tokens before persisting.
 */
export async function validateConnection(creds: OktaCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    await oktaGet(creds, "/api/v1/users?limit=1");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

interface OktaUser {
  id: string;
  status: string;
  profile: { login: string; email?: string };
}

interface OktaFactor {
  factorType: string;
  status: string;
}

/** Check: at least one ACTIVE MFA enrollment policy exists */
export async function checkMfaPolicyActive(creds: OktaCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Okta connection" } };
  try {
    const { json } = await oktaGet(creds, "/api/v1/policies?type=MFA_ENROLL");
    const policies = json as Array<{ id: string; name: string; status: string }>;
    const active = policies.filter((p) => p.status === "ACTIVE");
    return {
      status: active.length > 0 ? "pass" : "fail",
      observed_value: {
        total_mfa_enroll_policies: policies.length,
        active_policies: active.length,
        active_policy_names: active.map((p) => p.name).slice(0, 5),
      },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/** Check: every admin user has at least one active MFA factor */
export async function checkAdminsMfa(creds: OktaCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Okta connection" } };
  try {
    // Okta admin roles are assigned per-user. List active users, then for each
    // check assigned roles; if any admin role, verify a factor exists.
    const { json } = await oktaGet(creds, "/api/v1/users?filter=status+eq+%22ACTIVE%22&limit=200");
    const users = json as OktaUser[];

    const adminsMissingMfa: string[] = [];
    const adminsWithMfa: string[] = [];
    let adminCount = 0;

    for (const u of users) {
      const { json: rolesJson } = await oktaGet(creds, `/api/v1/users/${u.id}/roles`);
      const roles = rolesJson as Array<{ type: string; status: string }>;
      const isAdmin = roles.some((r) => /ADMIN/i.test(r.type) && r.status === "ACTIVE");
      if (!isAdmin) continue;
      adminCount++;

      const { json: factorsJson } = await oktaGet(creds, `/api/v1/users/${u.id}/factors`);
      const factors = factorsJson as OktaFactor[];
      const hasActiveFactor = factors.some((f) => f.status === "ACTIVE");
      if (hasActiveFactor) adminsWithMfa.push(u.profile.login);
      else adminsMissingMfa.push(u.profile.login);
    }

    if (adminCount === 0) {
      return { status: "not_collected", observed_value: { reason: "no admin users found" }, raw: null };
    }
    return {
      status:
        adminsMissingMfa.length === 0 ? "pass" : adminsWithMfa.length === 0 ? "fail" : "partial",
      observed_value: {
        total_admins: adminCount,
        admins_with_mfa: adminsWithMfa.length,
        admins_missing_mfa: adminsMissingMfa.length,
        admins_missing_mfa_logins: adminsMissingMfa.slice(0, 20),
      },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/** Check: system log accessible (liveness probe for audit logging) */
export async function checkSystemLogAccessible(creds: OktaCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Okta connection" } };
  try {
    const { json } = await oktaGet(creds, "/api/v1/logs?limit=1");
    const events = json as Array<unknown>;
    return {
      status: events.length > 0 ? "pass" : "fail",
      observed_value: { sample_event_count: events.length },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}
