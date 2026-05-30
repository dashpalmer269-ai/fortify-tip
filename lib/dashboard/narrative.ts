/**
 * Dashboard "practice in a sentence" narrative — cached.
 *
 * Wraps `summarizePracticePosture` (Opus 4.8) with state-hash invalidation:
 * a sha256 of the inputs the narrative is derived from is compared against
 * the last-stored hash on practices. Match → reuse cached prose; mismatch
 * → regenerate and write back. This is the single most expensive piece of
 * the admin dashboard render — without caching it fires on every refresh.
 *
 * State hash inputs:
 *   - overall weighted readiness %
 *   - critical-open count
 *   - signature of the top 5 open tasks (id + status + due-date), sorted
 *
 * Two of these change rarely; the third (task signature) changes when
 * tasks open/close/get reassigned. The hash captures meaningful change
 * without picking up render-only noise like ordering of equivalent items.
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { summarizePracticePosture, type PosturizeContext } from "@/lib/ai/compliance-ai";

type Db = SupabaseClient<Database>;

export function narrativeStateHash(input: {
  overall_pct: number;
  critical_open: number;
  top_task_signatures: string[];
}): string {
  const canonical = JSON.stringify({
    p: input.overall_pct,
    c: input.critical_open,
    t: [...input.top_task_signatures].sort(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Return a cached narrative if the state hash matches; otherwise generate,
 * persist, and return the fresh one. Generation failures fall back to the
 * last-cached prose (better stale than blank).
 */
export async function getOrGenerateNarrative(
  db: Db,
  practiceId: string,
  ctx: PosturizeContext,
  topTaskSignatures: string[]
): Promise<string> {
  const targetHash = narrativeStateHash({
    overall_pct: ctx.overall_pct,
    critical_open: ctx.critical_open,
    top_task_signatures: topTaskSignatures,
  });

  const { data: cached } = await db
    .from("practices")
    .select("dashboard_narrative, dashboard_narrative_state_hash")
    .eq("id", practiceId)
    .maybeSingle();

  if (
    cached?.dashboard_narrative &&
    cached.dashboard_narrative_state_hash === targetHash
  ) {
    return cached.dashboard_narrative;
  }

  try {
    const fresh = await summarizePracticePosture(ctx);
    if (fresh.trim().length > 0) {
      await db
        .from("practices")
        .update({
          dashboard_narrative: fresh,
          dashboard_narrative_state_hash: targetHash,
          dashboard_narrative_at: new Date().toISOString(),
        })
        .eq("id", practiceId);
      return fresh;
    }
  } catch (err) {
    console.error("[narrative] generation failed", {
      practice_id: practiceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return cached?.dashboard_narrative ?? "";
}
