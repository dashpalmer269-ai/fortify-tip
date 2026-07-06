import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  runCheck,
  recomputeControlStatus,
  type EvidenceCheckRow,
  type CredentialCache,
} from "@/lib/compliance/runner";
import { runEvidenceFlow } from "@/lib/compliance/evidence-flow";
import { sendEmail } from "@/lib/email/provider";
import { driftAlertEmail } from "@/lib/email/templates";
import { getOfficerRecipients } from "@/lib/email/recipients";

export const maxDuration = 300;

/**
 * Hourly compliance verifier.
 *
 * Loops every (practice × check) pair and runs the unified evidence flow
 * for any check past its frequency window. The flow is the same one that
 * runs on document upload and manual attestation — single pipeline,
 * every cybersecurity feature. Control recompute is deduped (collected
 * into a Set, run once per distinct control after the inner loop) and
 * task regeneration is batched at the end (skip per-flow regen via
 * regenerateTasks=false, then force-run once per touched practice).
 */
export async function GET(req: NextRequest) {
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
  const counts = {
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
  // Drifted checks queued for the end-of-run officer email fan-out.
  const driftEvents: Array<{
    practice_id: string;
    control_id: string;
    check_title: string;
  }> = [];
  // Per-run credential cache so 5 M365 checks → 1 decrypt, not 5.
  const credentialCache: CredentialCache = new Map();

  // 1. Load every active evidence check
  const { data: checks, error: ecErr } = await supabase
    .from("evidence_checks")
    .select("id, control_id, check_key, title, collection_method, source_integration, check_config, pass_criteria, frequency_hours");
  if (ecErr) return NextResponse.json({ error: `evidence_checks fetch: ${ecErr.message}` }, { status: 500 });
  if (!checks || checks.length === 0) return NextResponse.json({ ok: true, note: "no evidence checks defined" });

  // 2. Load every practice that has any controls enabled
  const { data: enabled, error: pcErr } = await supabase
    .from("practice_controls")
    .select("practice_id, control_id, status")
    .neq("status", "not_applicable");
  if (pcErr) return NextResponse.json({ error: `practice_controls fetch: ${pcErr.message}` }, { status: 500 });

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
      const { data: lastRows } = await supabase
        .from("practice_evidence")
        .select("collected_at")
        .eq("practice_id", practiceId)
        .eq("evidence_check_id", check.id)
        .eq("is_current", true)
        .limit(1);
      const last = lastRows?.[0];

      const freqHours = check.frequency_hours ?? 24;
      if (last && last.collected_at) {
        const hoursSince = (Date.now() - new Date(last.collected_at).getTime()) / 36e5;
        if (hoursSince < freqHours) {
          counts.checks_skipped_stale++;
          continue;
        }
      }

      counts.checks_attempted++;

      const result = await runCheck(supabase, practiceId, check as EvidenceCheckRow, {
        credentialCache,
      });

      // Unified evidence flow. We pass regenerateTasks=false because the cron
      // batches task regen at the end (one call per practice, not one per check).
      // recomputeControlStatus is also redundant inside the flow when we'll
      // dedupe and re-run at the end — but it's idempotent + cheap, so we let it
      // run for accuracy if a same-run subsequent check reads the rolled-up status.
      const outcome = await runEvidenceFlow(
        supabase,
        practiceId,
        check as EvidenceCheckRow,
        result,
        {
          trigger: "cron",
          actorUserId: null,
          regenerateTasks: false,
        }
      );

      const persistedStatus = outcome.persisted_status as keyof typeof counts;
      if (persistedStatus in counts) counts[persistedStatus]++;
      if (outcome.drift_detected) {
        counts.drift_alerts_created++;
        driftEvents.push({
          practice_id: practiceId,
          control_id: check.control_id,
          check_title: (check as EvidenceCheckRow & { title?: string }).title ?? check.check_key,
        });
      }

      controlsUpdated.add(`${practiceId}::${check.control_id}`);
    }
  }

  // 4. Re-recompute each touched control once (the in-flow recompute already
  //    ran but if the same control had multiple checks this guarantees the
  //    final rollup reflects all of them). Idempotent.
  for (const key of controlsUpdated) {
    const [practiceId, controlId] = key.split("::") as [string, string];
    try {
      await recomputeControlStatus(supabase, practiceId, controlId);
    } catch (err) {
      console.error("[verify-compliance] recompute failed", {
        practice_id: practiceId,
        control_id: controlId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 5. One task regen per touched practice (batched).
  const { generateTasksForPractice } = await import("@/lib/compliance/tasks");
  const touchedPractices = new Set<string>();
  for (const key of controlsUpdated) touchedPractices.add(key.split("::")[0]!);
  let tasksOpened = 0;
  let tasksResolved = 0;
  for (const practiceId of touchedPractices) {
    try {
      const r = await generateTasksForPractice(supabase, practiceId, { force: true });
      tasksOpened += r.auto_control_opened + r.policy_ack_opened;
      tasksResolved += r.auto_control_resolved + r.policy_ack_resolved;
    } catch (err) {
      console.error("[verify-compliance] task generation failed", {
        practice_id: practiceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 6. Drift alert emails — one per drifted check to the practice's
  //    officers, capped per practice per run so a bad integration day
  //    (say, expired credentials failing 20 checks at once) can't flood
  //    an inbox. The drift_alerts rows above are the complete record; the
  //    email is a nudge, not the ledger.
  const DRIFT_EMAILS_PER_PRACTICE_CAP = 5;
  let driftEmailsSent = 0;
  if (driftEvents.length > 0) {
    const origin = new URL(req.url).origin;
    const driftPracticeIds = [...new Set(driftEvents.map((d) => d.practice_id))];
    const { emailsByPractice } = await getOfficerRecipients(supabase, driftPracticeIds);

    const [{ data: practiceRows }, { data: controlRows }] = await Promise.all([
      supabase.from("practices").select("id, name").in("id", driftPracticeIds),
      supabase
        .from("controls")
        .select("id, title")
        .in("id", [...new Set(driftEvents.map((d) => d.control_id))]),
    ]);
    const practiceName = new Map((practiceRows ?? []).map((p) => [p.id, p.name]));
    const controlTitle = new Map((controlRows ?? []).map((c) => [c.id, c.title]));

    const sentPerPractice = new Map<string, number>();
    for (const drift of driftEvents) {
      const recipients = emailsByPractice.get(drift.practice_id) ?? [];
      if (recipients.length === 0) continue;
      const already = sentPerPractice.get(drift.practice_id) ?? 0;
      if (already >= DRIFT_EMAILS_PER_PRACTICE_CAP) continue;
      sentPerPractice.set(drift.practice_id, already + 1);

      const result = await sendEmail({
        to: recipients,
        subject: `Control drift detected: ${controlTitle.get(drift.control_id) ?? "a monitored control"}`,
        html: driftAlertEmail({
          practice_name: practiceName.get(drift.practice_id) ?? "your practice",
          control_title: controlTitle.get(drift.control_id) ?? "Monitored control",
          check_title: drift.check_title,
          app_url: origin,
        }),
        tag: "drift.alert",
      });
      if (result.ok) driftEmailsSent++;
    }
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - startedAt,
    ...counts,
    controls_updated: controlsUpdated.size,
    tasks_opened: tasksOpened,
    tasks_resolved: tasksResolved,
    drift_emails_sent: driftEmailsSent,
  });
}
