/**
 * Convenience type aliases over the generated `Database` interface.
 *
 *   import type { Tables, Inserts, Updates, Enums } from "@/lib/supabase/types";
 *   type Practice = Tables<"practices">;
 *   const draft: Inserts<"practices"> = { name: "Test", frameworks_enabled: ["HIPAA"] };
 *   const role: Tables<"practice_users">["role"] = "owner";
 *
 * The full row / insert / update shapes live in `database.types.ts`. Update
 * that file (via `npm run db:types` or by hand) whenever the schema changes.
 *
 * For JSONB columns, the generated type is `Json | null`. Where we know the
 * shape (e.g. `user_profiles.primary_address`), parse with zod at the
 * boundary and trust the parsed value past it. See `lib/compliance/no-phi.ts`
 * for the same pattern at the input layer.
 */

import type { Database } from "./database.types";

export type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type Inserts<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type Updates<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type FunctionReturns<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T]["Returns"];

export type FunctionArgs<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T]["Args"];

/** Shape we use for `user_profiles.primary_address` and the standard onboarding form. */
export interface PracticeAddress {
  street_1: string;
  street_2: string | null;
  city: string;
  region: string;
  postal_code: string;
}

/** Re-export for callers that want the whole Database interface. */
export type { Database } from "./database.types";
