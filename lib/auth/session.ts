/**
 * Server-side session state.
 *
 * One canonical loader fans out user → membership → profile in parallel, and
 * two helpers reshape the result for two consumers:
 *
 *   getAppSession()       → discriminated union for /app/* server pages
 *                           (active | pending | denied | no_practice | unauthenticated)
 *   getMarketingViewer()  → small DTO for the signed-in hamburger menu on
 *                           marketing pages
 *
 * Both share one round-trip to Supabase, one set of types, and one truth
 * about what "signed in" means. The legacy getCurrentUserAndPractice() in
 * server-auth.ts is gone; everywhere uses one of these two helpers now.
 */

import { cache } from "react";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import {
  ROLE_LABELS,
  isAdmin,
  type Role,
  type AccountType,
  type RequestStatus,
} from "@/lib/auth/permissions";
import { asPracticeId, asUserId, type PracticeId, type UserId } from "@/lib/supabase/ids";
import type { Tables } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";
import type { UserMenuViewer } from "@/components/marketing/UserMenu";

/* ──────────────────────────────────────────────────────────────────────── *
 * The shared base loader
 * ──────────────────────────────────────────────────────────────────────── */

interface RawState {
  user: User | null;
  membership: {
    practice_id: PracticeId;
    role: Role;
    practice_name: string;
    frameworks_enabled: string[] | null;
    hipaa_covered_entity: boolean | null;
  } | null;
  profile: Tables<"user_profiles"> | null;
}

/**
 * Single Supabase round-trip that resolves everything an authenticated
 * request might need to render. Branded IDs are minted here so consumers
 * never deal with raw UUIDs.
 *
 * Wrapped in React `cache()` so layout + page sharing the same render only
 * hit Supabase once — without this the auth+membership+profile triad runs
 * 2-3× per authenticated page load.
 */
const loadRawState = cache(async function loadRawState(): Promise<RawState> {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, membership: null, profile: null };

  const [{ data: membershipRow }, { data: profile }] = await Promise.all([
    supabase
      .from("practice_users")
      .select("practice_id, role, practices(id, name, frameworks_enabled, hipaa_covered_entity)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .returns<{
        practice_id: string;
        role: Role;
        practices: {
          id: string;
          name: string;
          frameworks_enabled: string[] | null;
          hipaa_covered_entity: boolean | null;
        } | null;
      } | null>(),
    supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const membership = membershipRow
    ? {
        practice_id: asPracticeId(membershipRow.practice_id),
        role: membershipRow.role,
        practice_name: membershipRow.practices?.name ?? "Practice",
        frameworks_enabled: membershipRow.practices?.frameworks_enabled ?? null,
        hipaa_covered_entity: membershipRow.practices?.hipaa_covered_entity ?? null,
      }
    : null;

  return { user, membership, profile: profile ?? null };
});

/* ──────────────────────────────────────────────────────────────────────── *
 * App-side: discriminated union for server pages
 * ──────────────────────────────────────────────────────────────────────── */

export type AppSession =
  | { kind: "unauthenticated" }
  | {
      kind: "active";
      user: User;
      userId: UserId;
      membership: NonNullable<RawState["membership"]>;
    }
  | { kind: "pending"; user: User; userId: UserId; profile: Tables<"user_profiles"> }
  | { kind: "denied"; user: User; userId: UserId; profile: Tables<"user_profiles"> }
  | {
      kind: "no_practice";
      user: User;
      userId: UserId;
      accountType: AccountType;
      profile: Tables<"user_profiles"> | null;
    };

/**
 * The session helper for /app/* server pages. Use with assertActive() if
 * the route is protected, or switch on `kind` if the route handles multiple
 * states explicitly.
 */
export async function getAppSession(): Promise<AppSession> {
  const raw = await loadRawState();
  if (!raw.user) return { kind: "unauthenticated" };

  const userId = asUserId(raw.user.id);

  if (raw.membership) {
    return { kind: "active", user: raw.user, userId, membership: raw.membership };
  }

  const status = (raw.profile?.status ?? "pending") as RequestStatus;
  const accountType = (raw.profile?.account_type ??
    (raw.user.user_metadata?.account_type as AccountType | undefined) ??
    "admin") as AccountType;

  if (accountType === "employee") {
    if (status === "denied") {
      return { kind: "denied", user: raw.user, userId, profile: raw.profile! };
    }
    if (status === "pending" && raw.profile?.onboarded_at) {
      return { kind: "pending", user: raw.user, userId, profile: raw.profile };
    }
  }

  return {
    kind: "no_practice",
    user: raw.user,
    userId,
    accountType,
    profile: raw.profile,
  };
}

/**
 * Narrows an AppSession to the active variant. Throws if the session isn't
 * active — meant for routes that are gated by app/app/layout.tsx and would
 * never reach a non-active code path in production.
 */
export function assertActive(
  session: AppSession
): asserts session is Extract<AppSession, { kind: "active" }> {
  if (session.kind !== "active") {
    throw new Error(`Expected active session, got ${session.kind}`);
  }
}

/* ──────────────────────────────────────────────────────────────────────── *
 * Marketing-side: viewer DTO for the signed-in hamburger menu
 * ──────────────────────────────────────────────────────────────────────── */

export async function getMarketingViewer(): Promise<UserMenuViewer | null> {
  const raw = await loadRawState();
  if (!raw.user) return null;

  const role: Role | null = raw.membership?.role ?? null;
  const metaAccountType = raw.user.user_metadata?.account_type as
    | AccountType
    | undefined;
  const accountType: AccountType =
    raw.profile?.account_type ?? metaAccountType ?? "admin";

  return {
    email: raw.user.email ?? "",
    fullName: raw.profile?.full_name ?? null,
    accountType,
    hasMembership: !!raw.membership,
    practiceName: raw.membership?.practice_name ?? null,
    roleLabel: role ? ROLE_LABELS[role] : null,
    isAdminLike: isAdmin(role),
  };
}
