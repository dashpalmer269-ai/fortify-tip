import { createBrowserClient as create } from "@supabase/ssr";

/**
 * Supabase client for use inside "use client" components.
 * Reads + writes the session cookie automatically, so RLS gets the right user.
 */
export function createBrowserClient() {
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
