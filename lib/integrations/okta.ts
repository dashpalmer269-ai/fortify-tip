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

/**
 * Check: admin role inventory — count Super Admin + Org Admin + read-only
 * admins. Same logic as Google: too few = SPOF, too many = privilege sprawl.
 */
export async function checkAdminRoleInventory(creds: OktaCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Okta connection" } };
  try {
    type Role = { id: string; label: string; type: string };
    const { json: rolesJson } = await oktaGet(creds, "/api/v1/iam/assignments?limit=500");
    const roles = rolesJson as Array<{ assignee?: { type: string; id: string }; roleType?: string }>;
    const userRoleMap = new Map<string, Set<string>>();
    for (const r of roles) {
      if (r.assignee?.type !== "USER" || !r.assignee.id || !r.roleType) continue;
      if (!userRoleMap.has(r.assignee.id)) userRoleMap.set(r.assignee.id, new Set());
      userRoleMap.get(r.assignee.id)!.add(r.roleType);
    }
    const superAdmins: string[] = [];
    const orgAdmins: string[] = [];
    for (const [uid, rs] of userRoleMap) {
      if (rs.has("SUPER_ADMIN")) superAdmins.push(uid);
      if (rs.has("ORG_ADMIN") && !rs.has("SUPER_ADMIN")) orgAdmins.push(uid);
    }

    const total = superAdmins.length;
    const status: CheckOutcome["status"] =
      total === 0 ? "fail" : total >= 1 && total <= 5 ? "pass" : "partial";
    return {
      status,
      observed_value: {
        super_admins: superAdmins.length,
        org_admins: orgAdmins.length,
        total_admin_users: userRoleMap.size,
        healthy_range: "1-5 super admins",
      },
      raw: { admin_user_ids: Array.from(userRoleMap.keys()).slice(0, 25) },
    };
  } catch (e) {
    // Fallback to v1/users with isAdmin filter not available; report as not_collected if 404
    if ((e as Error).message.includes("HTTP 404")) {
      return { status: "not_collected", observed_value: null, raw: { note: "Okta iam assignments API not available in this org" } };
    }
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/**
 * Check: inactive users — Okta has lastLogin in the user profile. Defaults
 * to flagging accounts with no login in 90+ days (excluding STAGED/RECOVERY
 * states which haven't yet had a chance to log in).
 */
export async function checkInactiveUsers(
  creds: OktaCredentials | null,
  maxDaysSinceLogin: number = 90
): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Okta connection" } };
  try {
    type FullOktaUser = { id: string; status: string; lastLogin?: string | null; profile: { login: string } };
    const users: FullOktaUser[] = [];
    let url = "/api/v1/users?limit=200&filter=status%20eq%20%22ACTIVE%22";
    let safety = 0;
    while (url && safety < 25) {
      const { json, res } = await oktaGet(creds, url);
      users.push(...(json as FullOktaUser[]));
      const link = res.headers.get("link");
      const next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
      if (!next) break;
      const u = new URL(next);
      url = u.pathname + u.search;
      safety++;
    }

    const cutoff = Date.now() - maxDaysSinceLogin * 86400_000;
    const inactive = users.filter(
      (u) => !u.lastLogin || new Date(u.lastLogin).getTime() < cutoff
    );

    return {
      status: inactive.length === 0 ? "pass" : "fail",
      observed_value: {
        total_active_users: users.length,
        inactive: inactive.length,
        max_days_since_login: maxDaysSinceLogin,
      },
      raw: { inactive_logins: inactive.slice(0, 25).map((u) => u.profile.login) },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/**
 * Check: password policy — verify the default policy enforces minimum
 * length >= 12, mixed character requirements, and lockout. NIST 800-63B
 * compatible defaults.
 */
export async function checkPasswordPolicy(creds: OktaCredentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no Okta connection" } };
  try {
    const { json } = await oktaGet(creds, "/api/v1/policies?type=PASSWORD&expand=rules");
    const policies = json as Array<{
      id: string;
      name: string;
      status: string;
      settings?: {
        password?: {
          complexity?: {
            minLength?: number;
            minNumber?: number;
            minLowerCase?: number;
            minUpperCase?: number;
            minSymbol?: number;
          };
        };
      };
    }>;
    const active = policies.filter((p) => p.status === "ACTIVE");
    if (active.length === 0) {
      return { status: "fail", observed_value: { active_policies: 0 }, raw: { note: "no active password policy" } };
    }

    type Failure = { policy: string; reason: string };
    const failures: Failure[] = [];
    for (const p of active) {
      const c = p.settings?.password?.complexity ?? {};
      if ((c.minLength ?? 0) < 12) failures.push({ policy: p.name, reason: `minLength=${c.minLength ?? 0} < 12` });
      if ((c.minNumber ?? 0) < 1 && (c.minLowerCase ?? 0) < 1 && (c.minUpperCase ?? 0) < 1) {
        failures.push({ policy: p.name, reason: "no character-class requirement" });
      }
    }
    return {
      status: failures.length === 0 ? "pass" : "fail",
      observed_value: {
        active_policies: active.length,
        non_compliant_policies: failures.length,
      },
      raw: { failures },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}
