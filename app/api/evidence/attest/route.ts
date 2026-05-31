import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";
import { parseBody } from "@/lib/schemas/api";
import { runEvidenceFlow } from "@/lib/compliance/evidence-flow";
import type { EvidenceCheckRow, CheckResult } from "@/lib/compliance/runner";

/**
 * Manual attestation: practice admin clicks "Attest now" for a
 * `manual_attestation` control (quarterly access reviews, annual IR-plan
 * sign-off, etc.). Records an evidence row with collected_by = the
 * attesting user, then runs the full evidence flow.
 *
 * Renewal cadence is enforced by the existing runManualAttestation runner
 * which checks `collected_at` against pass_criteria.value (days). So
 * attesting today clears the failure; the failure returns when the
 * renewal window elapses.
 */
const AttestSchema = z.object({
  evidence_check_id: z.string().uuid(),
  statement: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (session.kind !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(AttestSchema, req, { phiFields: ["statement"] });
  if (!parsed.ok) return parsed.response;
  const { evidence_check_id, statement } = parsed.data;

  const { data: check } = await db
    .from("evidence_checks")
    .select("id, control_id, check_key, collection_method, source_integration, check_config, pass_criteria")
    .eq("id", evidence_check_id)
    .maybeSingle()
    .returns<EvidenceCheckRow | null>();
  if (!check) return NextResponse.json({ error: "Evidence check not found" }, { status: 404 });
  if (check.collection_method !== "manual_attestation") {
    return NextResponse.json(
      { error: "This check is not a manual_attestation type" },
      { status: 400 }
    );
  }

  const renewalDays = (check.pass_criteria?.value as number) ?? 365;
  const now = new Date().toISOString();

  const collectorResult: CheckResult = {
    status: "pass",
    observed_value: {
      last_attested_at: now,
      attested_by: session.user.id,
      renewal_due: false,
      renewal_days: renewalDays,
    },
    raw: { source: "manual_attestation", statement: statement ?? null },
  };

  const outcome = await runEvidenceFlow(
    db,
    session.membership.practice_id,
    check,
    collectorResult,
    {
      trigger: "manual_attestation",
      actorUserId: session.user.id,
      notes: statement ?? null,
    }
  );

  return NextResponse.json({
    ok: true,
    evidence_id: outcome.evidenceId,
    control_status: outcome.control_status,
    next_renewal_days: renewalDays,
  });
}
