import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runCheck, recomputeControlStatus, stateHash, type EvidenceCheckRow } from "@/lib/compliance/runner";

export const maxDuration = 300;

/**
 * Hourly compliance verifier.
 *
 * Iterates every evidence_check defined in the library, for every practice that
 * has the parent control enabled. Skips checks that ran within their frequency
 * window. Persists results to practice_evidence + evidence_snapshots, detects
 * drift, and rolls control status forward.
 */
export async function GET(req: NextRequest) {
  // Same auth pattern as the threat-intel cron.
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = req.nextUrl.searchParams.get("secret");
  const secret = bearerSecret ?? querySecret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const startedAt = Date.now();
  const counts: Record<string, number> = {
    checks_attempted: 0,
    checks_skipped_stale: 0,
    pass: 0,
    fail: 0,
    partial: 0,
    not_collected: 0,
    error: 0,
    drift_alerts_created: 0,
  };
  const controlsUpdated = new Set<string>();

  // 1. Load every active evidence check
  const { data: checks, error: ecErr } = await supabase
    .from("evidence_checks")
    .select("id, control_id, check_key, collection_method, source_integration, check_config, pass_criteria, frequency_hours");
  if (ecErr) return NextResponse.json({ error: `evidence_checks fetch: ${ecErr.message}` }, { status: 500 });
  if (!checks || checks.length === 0) return NextResponse.json({ ok: true, note: "no evidence checks defined" });

  // 2. Load every practice that has any controls enabled
  const { data: enabled, error: pcErr } = await supabase
    .from("practice_controls")
    .select("practice_id, control_id, status")
    .neq("status", "not_applicable");
  if (pcErr) return NextResponse.json({ error: `practice_controls fetch: ${pcErr.message}` }, { status: 500 });

  // Build (control_id) -> [practice_id...] index
  const practicesByControl = new Map<string, string[]>();
  for (const row of enabled ?? []) {
    if (!practicesByControl.has(row.control_id)) practicesByControl.set(row.control_id, []);
    practicesByControl.get(row.control_id)!.push(row.practice_id);
  }

  // 3. For each (check × practice), run if due
  for (const check of checks) {
    const practices = practicesByControl.get(check.control_id) ?? [];
    if (practices.length === 0) continue;

    for (const practiceId of practices) {
      // Look at the most recent evidence row to decide if this check is due
      const { data: lastRows } = await supabase
        .from("practice_evidence")
        .select("collected_at, state_hash, status, observed_value")
        .eq("practice_id", practiceId)
        .eq("evidence_check_id", check.id)
        .eq("is_current", true)
        .limit(1);
      const last = lastRows?.[0];

      const freqHours = check.frequency_hours ?? 24;
      if (last) {
        const hoursSince = (Date.now() - new Date(last.collected_at).getTime()) / 36e5;
        if (hoursSince < freqHours) {
          counts.checks_skipped_stale++;
          continue;
        }
      }

      counts.checks_attempted++;

      // Execute the check
      const result = await runCheck(supabase, practiceId, check as EvidenceCheckRow);
      const hash = stateHash(result.observed_value);

      // Flip prior current row → false, then insert the new one
      await supabase
        .from("practice_evidence")
        .update({ is_current: false })
        .eq("practice_id", practiceId)
        .eq("evidence_check_id", check.id)
        .eq("is_current", true);

      await supabase.from("practice_evidence").insert({
        practice_id: practiceId,
        evidence_check_id: check.id,
        status: result.status,
        observed_value: result.observed_value as never,
        raw_result: result.raw as never,
        state_hash: hash,
        collected_by: null,
        is_current: true,
      });

      // Append immutable snapshot for the historical trail
      await supabase.from("evidence_snapshots").insert({
        practice_id: practiceId,
        evidence_check_id: check.id,
        state_hash: hash,
        observed_value: result.observed_value as never,
      });

      counts[result.status] = (counts[result.status] ?? 0) + 1;

      // Drift detection: state changed AND now failing → alert + audit log
      if (last && last.state_hash !== hash && result.status === "fail") {
        await supabase.from("drift_alerts").insert({
          practice_id: practiceId,
          evidence_check_id: check.id,
          previous_state: last.observed_value as never,
          current_state: result.observed_value as never,
          severity: "high",
        });
        await supabase.from("audit_logs").insert({
          practice_id: practiceId,
          actor_service: "system_cron",
          action: "evidence.drift_detected",
          resource_type: "practice_evidence",
          resource_id: check.id,
          metadata: { check_key: check.check_key, from_status: last.status, to_status: result.status },
        });
        counts.drift_alerts_created++;
      }

      // Roll up control status from its evidence
      await recomputeControlStatus(supabase, practiceId, check.control_id);
      controlsUpdated.add(`${practiceId}::${check.control_id}`);
    }
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - startedAt,
    ...counts,
    controls_updated: controlsUpdated.size,
  });
}
