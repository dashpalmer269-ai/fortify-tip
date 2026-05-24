import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { ROLE_LABELS, isAdmin, type Role } from "@/lib/auth/permissions";
import type { UserMenuViewer } from "@/components/marketing/UserMenu";

/**
 * Build the marketing-nav viewer for the current request.
 * Returns null when no user is signed in.
 */
export async function getMarketingViewer(): Promise<UserMenuViewer | null> {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("practice_users")
      .select("role, practices(name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("full_name, account_type")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const role = (membership?.role as Role | undefined) ?? null;
  const practiceName =
    (membership?.practices as unknown as { name: string } | null)?.name ?? null;

  const metaAccountType = user.user_metadata?.account_type as
    | "admin"
    | "employee"
    | undefined;
  const accountType: "admin" | "employee" =
    profile?.account_type ?? metaAccountType ?? "admin";

  return {
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    accountType,
    hasMembership: !!membership,
    practiceName,
    roleLabel: role ? ROLE_LABELS[role] : null,
    isAdminLike: isAdmin(role ?? undefined),
  };
}
