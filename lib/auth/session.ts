/**
 * Unified server-side session helper.
 *
 * Returns a discriminated union the caller can switch on, eliminating the
 * repeated "if (!session) redirect / if (!session.membership) redirect"
 * dance from every server page in /app/*.
 *
 *   const s = await getAppSession();
 *   switch (s.kind) {
 *     case "unauthenticated":  redirect("/login");
 *     case "denied":           redirect("/denied");
 *     case "pending":          redirect("/pending");
 *     case "no_practice":      redirect("/app/onboarding");
 *     case "active":
 *       // s.membership and s.role are now fully typed and present
 *   }
 *
 * The existing `getCurrentUserAndPractice()` continues to work; this is an
 * additive helper. Pages can adopt it organically.
 */

import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import type { Tables } from "@/lib/supabase/types";
import type { Role, AccountType, RequestStatus } from "@/lib/auth/permissions";
import type { User } from "@supabase/supabase-js";

interface ActiveMembership {
  practice_id: string;
  role: Role;
  practice_name: string;
  frameworks_enabled: string[] | null;
  hipaa_covered_entity: boolean | null;
}

export type AppSession =
  | { kind: "unauthenticated" }
  | { kind: "active"; user: User; membership: ActiveMembership }
  | {
      kind: "pending";
      user: User;
      profile: Tables<"user_profiles">;
    }
  | {
      kind: "denied";
      user: User;
      profile: Tables<"user_profiles">;
    }
  | {
      kind: "no_practice";
      user: User;
      accountType: AccountType;
      profile: Tables<"user_profiles"> | null;
    };

/**
 * Resolve everything you need to render an /app/* page in one round-trip
 * fan-out. Branches are computed server-side so the route handler is just
 * a switch on `s.kind`.
 */
export async function getAppSession(): Promise<AppSession> {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" };

  // Membership + profile in parallel.
  const [{ data: membershipRow }, { data: profile }] = await Promise.all([
    supabase
      .from("practice_users")
      .select("practice_id, role, practices(id, name, frameworks_enabled, hipaa_covered_entity)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  if (membershipRow) {
    const practiceData = membershipRow.practices as unknown as {
      id: string;
      name: string;
      frameworks_enabled: string[] | null;
      hipaa_covered_entity: boolean | null;
    } | null;

    return {
      kind: "active",
      user,
      membership: {
        practice_id: membershipRow.practice_id,
        role: membershipRow.role as Role,
        practice_name: practiceData?.name ?? "Practice",
        frameworks_enabled: practiceData?.frameworks_enabled ?? null,
        hipaa_covered_entity: practiceData?.hipaa_covered_entity ?? null,
      },
    };
  }

  // No membership — branch on the profile's account_type + status
  const status = (profile?.status ?? "pending") as RequestStatus;
  const accountType = (profile?.account_type ??
    (user.user_metadata?.account_type as AccountType | undefined) ??
    "admin") as AccountType;

  if (accountType === "employee") {
    if (status === "denied") {
      return { kind: "denied", user, profile: profile as Tables<"user_profiles"> };
    }
    if (status === "pending" && profile?.onboarded_at) {
      return { kind: "pending", user, profile: profile as Tables<"user_profiles"> };
    }
  }

  return {
    kind: "no_practice",
    user,
    accountType,
    profile: (profile ?? null) as Tables<"user_profiles"> | null,
  };
}

/**
 * Type guard for use inside server components: shorthand to assert "I'm
 * past the redirect tree, I know the session is active."
 */
export function assertActive(session: AppSession): asserts session is Extract<
  AppSession,
  { kind: "active" }
> {
  if (session.kind !== "active") {
    throw new Error(`Expected active session, got ${session.kind}`);
  }
}
