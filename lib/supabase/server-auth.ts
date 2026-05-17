import { createServerClient as create } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for server components and route handlers that need the
 * authenticated user (auth.uid() inside RLS, etc.). Reads the cookie jar.
 *
 * For service-role / cron access without a user, keep using
 * createServerClient() from './server.ts' instead.
 */
export async function createAuthedServerClient() {
  const cookieStore = await cookies();

  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — cookies are read-only there.
            // Session refresh happens in middleware, so this is safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Resolve the current user + their primary practice in one shot.
 * Returns null if not signed in or not yet attached to a practice.
 */
export async function getCurrentUserAndPractice() {
  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id, role, practices(id, name, frameworks_enabled, hipaa_covered_entity)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return {
    user,
    membership,
    supabase,
  };
}
