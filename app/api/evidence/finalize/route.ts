import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";
import { parseBody } from "@/lib/schemas/api";
import { runEvidenceFlow } from "@/lib/compliance/evidence-flow";
import type { EvidenceCheckRow, CheckResult } from "@/lib/compliance/runner";

/**
 * Step 2 of the document-upload flow: once the browser PUTs the file to
 * Supabase Storage, it calls this endpoint to commit the evidence.
 *
 * Runs the unified evidence flow: verify → persist → snapshot → drift →
 * recompute → audit-log → tasks. Identical pipeline to the cron's scan path.
 */
const FinalizeSchema = z.object({
  evidence_check_id: z.string().uuid(),
  path: z.string().min(1),
  file_name: z.string().min(1).max(200),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  assertActive(session);
  if (!isAdmin(session.membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(FinalizeSchema, req, { phiFields: ["notes"] });
  if (!parsed.ok) return parsed.response;
  const { evidence_check_id, path, file_name, notes } = parsed.data;

  // Path must start with this practice's ID (defense-in-depth on top of storage RLS)
  if (!path.startsWith(`${session.membership.practice_id}/`)) {
    return NextResponse.json({ error: "Path does not belong to this practice" }, { status: 403 });
  }

  // Load the check
  const { data: check } = await db
    .from("evidence_checks")
    .select("id, control_id, check_key, collection_method, source_integration, check_config, pass_criteria")
    .eq("id", evidence_check_id)
    .maybeSingle()
    .returns<EvidenceCheckRow | null>();
  if (!check) return NextResponse.json({ error: "Evidence check not found" }, { status: 404 });
  if (check.collection_method !== "document_upload") {
    return NextResponse.json(
      { error: "This check is not a document_upload type" },
      { status: 400 }
    );
  }

  // Verify the file actually exists in storage — defense against a finalize
  // call that wasn't preceded by an upload.
  const { data: filesAtPath } = await db.storage
    .from("evidence")
    .list(path.split("/").slice(0, -1).join("/"), { search: path.split("/").pop() });
  if (!filesAtPath || filesAtPath.length === 0) {
    return NextResponse.json(
      { error: "File not found in storage. Upload first, then finalize." },
      { status: 400 }
    );
  }

  const maxAge = (check.check_config?.max_age_days as number) ?? 365;
  const now = new Date().toISOString();

  // A fresh document is, by definition, current evidence.
  const collectorResult: CheckResult = {
    status: "pass",
    observed_value: {
      uploaded_at: now,
      file_name,
      latest_document_at: now,
      max_age_days: maxAge,
    },
    raw: { source: "document_upload", path },
  };

  const outcome = await runEvidenceFlow(
    db,
    session.membership.practice_id,
    check,
    collectorResult,
    {
      trigger: "document_upload",
      actorUserId: session.user.id,
      evidenceFileUrl: path,
      notes: notes ?? null,
    }
  );

  return NextResponse.json({
    ok: true,
    evidence_id: outcome.evidenceId,
    control_status: outcome.control_status,
  });
}
