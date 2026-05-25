import { createBrowserClient as create } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase client for use inside "use client" components.
 * Reads + writes the session cookie automatically, so RLS gets the right user.
 *
 * Typed with the generated Database schema so .from('foo').select(...) /
 * .insert(...) checks against the actual table shape at compile time.
 */
export function createBrowserClient() {
  return create<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
