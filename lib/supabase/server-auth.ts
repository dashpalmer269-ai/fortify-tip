import { createServerClient as create } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Supabase client for server components and route handlers that need the
 * authenticated user (auth.uid() inside RLS, etc.). Reads the cookie jar.
 *
 * For service-role / cron access without a user, use createServerClient()
 * from './server.ts' instead.
 *
 * For session-state with discriminated union (active / pending / denied /
 * no_practice / unauthenticated), use getAppSession() from
 * '@/lib/auth/session' — that's the single source of truth across the app.
 */
export async function createAuthedServerClient() {
  const cookieStore = await cookies();

  return create<Database>(
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
            // Server Components have read-only cookies; safe to ignore.
          }
        },
      },
    }
  );
}
