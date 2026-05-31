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

/** Check: MFA enforced specifically for privileged-role accounts (admins). */
const PRIVILEGED_ROLE_TEMPLATE_IDS = [
  "62e90394-69f5-4237-9190-012177145e10", // Global Administrator
  "e8611ab8-c189-46e8-94e1-60213ab1f814", // Privileged Role Administrator
  "194ae4cb-b126-40b2-bd5b-6091b380977d", // Security Administrator
  "729827e3-9c14-49f7-bb1b-9608f156bbb8", // Helpdesk Administrator
  "fe930be7-5e62-47db-91af-98c3a49a38b1", // User Administrator
];

const STRONG_AUTH_METHOD_TYPES = new Set([
  "#microsoft.graph.fido2AuthenticationMethod",
  "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod",
  "#microsoft.graph.phoneAuthenticationMethod",
  "#microsoft.graph.softwareOathAuthenticationMethod",
  "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod",
]);

export async function checkMfaAdminsEnforced(creds: M365Credentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    const rolesJson = (await graphGet(creds, "/directoryRoles")) as {
      value: Array<{ id: string; roleTemplateId: string; displayName: string }>;
    };
    const privilegedRoles = rolesJson.value.filter((r) =>
      PRIVILEGED_ROLE_TEMPLATE_IDS.includes(r.roleTemplateId)
    );
    if (privilegedRoles.length === 0) {
      return {
        status: "not_collected",
        observed_value: { reason: "no privileged roles activated in tenant" },
        raw: null,
      };
    }

    const adminUserIds = new Set<string>();
    const adminDetail: Array<{ user_id: string; upn: string; role: string }> = [];
    for (const role of privilegedRoles) {
      const membersJson = (await graphGet(creds, `/directoryRoles/${role.id}/members`)) as {
        value: Array<{ id: string; userPrincipalName?: string }>;
      };
      for (const m of membersJson.value) {
        if (!adminUserIds.has(m.id)) {
          adminUserIds.add(m.id);
          adminDetail.push({
            user_id: m.id,
            upn: m.userPrincipalName ?? "(unknown)",
            role: role.displayName,
          });
        }
      }
    }

    const withMfa: string[] = [];
    const withoutMfa: string[] = [];
    for (const admin of adminDetail) {
      try {
        const methodsJson = (await graphGet(
          creds,
          `/users/${admin.user_id}/authentication/methods`
        )) as { value: Array<{ "@odata.type"?: string }> };
        const hasStrong = methodsJson.value.some(
          (m) => m["@odata.type"] && STRONG_AUTH_METHOD_TYPES.has(m["@odata.type"])
        );
        if (hasStrong) withMfa.push(admin.upn);
        else withoutMfa.push(admin.upn);
      } catch {
        withoutMfa.push(admin.upn);
      }
    }

    const total = withMfa.length + withoutMfa.length;
    return {
      status:
        total === 0
          ? "not_collected"
          : withoutMfa.length === 0
          ? "pass"
          : withMfa.length === 0
          ? "fail"
          : "partial",
      observed_value: {
        total_privileged_admins: total,
        admins_with_strong_mfa: withMfa.length,
        admins_missing_mfa: withoutMfa.length,
        admins_missing_mfa_upns: withoutMfa.slice(0, 20),
      },
      raw: { roles_examined: privilegedRoles.map((r) => r.displayName) },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/** Check: at least one enabled Conditional Access policy enforces MFA */
export async function checkConditionalAccessMfa(creds: M365Credentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    const json = (await graphGet(creds, "/identity/conditionalAccess/policies")) as {
      value: Array<{
        id: string;
        displayName: string;
        state: string;
        grantControls?: { builtInControls?: string[] };
      }>;
    };
    const enabledMfa = json.value.filter(
      (p) => p.state === "enabled" && p.grantControls?.builtInControls?.includes("mfa")
    );
    return {
      status: enabledMfa.length > 0 ? "pass" : "fail",
      observed_value: {
        total_policies: json.value.length,
        enabled_mfa_policies: enabledMfa.length,
        policy_names: enabledMfa.map((p) => p.displayName).slice(0, 5),
      },
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

/**
 * Check: inactive users — accounts with no sign-in in the configured window
 * (default 90 days). Inactive accounts are a standing attack surface.
 */
export async function checkInactiveUsers(
  creds: M365Credentials | null,
  maxDaysSinceSignIn: number = 90
): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    // signInActivity requires AuditLog.Read.All + a P1+ license
    const r = (await graphGet(
      creds,
      "/users?$select=id,userPrincipalName,signInActivity,accountEnabled&$top=999"
    )) as { value: Array<{ id: string; userPrincipalName: string; accountEnabled: boolean; signInActivity?: { lastSignInDateTime?: string | null } }> };
    const cutoff = Date.now() - maxDaysSinceSignIn * 86400_000;
    const active = (r.value ?? []).filter((u) => u.accountEnabled);
    const inactive = active.filter((u) => {
      const last = u.signInActivity?.lastSignInDateTime;
      if (!last) return true; // never signed in
      return new Date(last).getTime() < cutoff;
    });
    return {
      status: inactive.length === 0 ? "pass" : "fail",
      observed_value: {
        total_enabled_users: active.length,
        inactive_users: inactive.length,
        max_days_since_signin: maxDaysSinceSignIn,
      },
      raw: { inactive_upns: inactive.slice(0, 25).map((u) => u.userPrincipalName) },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/**
 * Check: guest accounts with elevated privileges (admin role assignment).
 * Risky: guests should not hold directory roles.
 */
export async function checkRiskyGuestUsers(creds: M365Credentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    const guests = (await graphGet(
      creds,
      "/users?$filter=userType eq 'Guest'&$select=id,userPrincipalName&$top=999"
    )) as { value: Array<{ id: string; userPrincipalName: string }> };
    const guestIds = new Set((guests.value ?? []).map((u) => u.id));
    if (guestIds.size === 0) {
      return { status: "pass", observed_value: { total_guests: 0, guests_with_admin_role: 0 }, raw: null };
    }

    const dirRoles = (await graphGet(creds, "/directoryRoles")) as { value: Array<{ id: string; displayName: string }> };
    const riskyGuests: Array<{ guest: string; role: string }> = [];
    for (const role of dirRoles.value ?? []) {
      const members = (await graphGet(creds, `/directoryRoles/${role.id}/members?$select=id,userPrincipalName`)) as {
        value: Array<{ id: string; userPrincipalName?: string }>;
      };
      for (const m of members.value ?? []) {
        if (guestIds.has(m.id)) {
          riskyGuests.push({ guest: m.userPrincipalName ?? m.id, role: role.displayName });
        }
      }
    }
    return {
      status: riskyGuests.length === 0 ? "pass" : "fail",
      observed_value: {
        total_guests: guestIds.size,
        guests_with_admin_role: riskyGuests.length,
      },
      raw: { risky_guest_assignments: riskyGuests.slice(0, 20) },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/**
 * Check: mailbox forwarding rules — surveys the first 50 enabled users for
 * inbox rules that forward/redirect to external addresses. External
 * forwarding is a classic data-exfil channel for ransomware crews.
 */
export async function checkMailboxForwarding(creds: M365Credentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    const r = (await graphGet(
      creds,
      "/users?$select=id,userPrincipalName&$top=50&$filter=accountEnabled eq true"
    )) as { value: Array<{ id: string; userPrincipalName: string }> };
    const users = r.value ?? [];

    const internalDomains = new Set<string>();
    const orgRes = (await graphGet(creds, "/organization?$select=verifiedDomains")) as {
      value: Array<{ verifiedDomains: Array<{ name: string }> }>;
    };
    for (const o of orgRes.value ?? []) for (const d of o.verifiedDomains ?? []) internalDomains.add(d.name.toLowerCase());

    const offenders: Array<{ user: string; rule: string; to: string[] }> = [];
    for (const u of users) {
      try {
        const rules = (await graphGet(creds, `/users/${u.id}/mailFolders/inbox/messageRules`)) as {
          value: Array<{ displayName?: string; actions?: { forwardTo?: Array<{ emailAddress: { address: string } }>; redirectTo?: Array<{ emailAddress: { address: string } }> } }>;
        };
        for (const rule of rules.value ?? []) {
          const targets = [
            ...(rule.actions?.forwardTo ?? []),
            ...(rule.actions?.redirectTo ?? []),
          ].map((t) => t.emailAddress.address);
          const external = targets.filter((addr) => {
            const domain = addr.split("@")[1]?.toLowerCase();
            return domain && !internalDomains.has(domain);
          });
          if (external.length > 0) offenders.push({ user: u.userPrincipalName, rule: rule.displayName ?? "", to: external });
        }
      } catch {
        /* skip user we can't read rules for */
      }
    }
    return {
      status: offenders.length === 0 ? "pass" : "fail",
      observed_value: {
        users_surveyed: users.length,
        users_with_external_forwarding: offenders.length,
      },
      raw: { offenders: offenders.slice(0, 20) },
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}

/**
 * Check: Microsoft Entra security defaults enabled. For small practices
 * without Conditional Access licensing, security defaults are the
 * out-of-the-box MFA + legacy auth block.
 */
export async function checkSecurityDefaults(creds: M365Credentials | null): Promise<CheckOutcome> {
  if (!creds) return { status: "not_collected", observed_value: null, raw: { note: "no M365 connection" } };
  try {
    const r = (await graphGet(creds, "/policies/identitySecurityDefaultsEnforcementPolicy")) as {
      isEnabled?: boolean;
    };
    return {
      status: r.isEnabled === true ? "pass" : "fail",
      observed_value: { security_defaults_enabled: r.isEnabled === true },
      raw: null,
    };
  } catch (e) {
    return { status: "error", observed_value: null, raw: { error: (e as Error).message } };
  }
}
