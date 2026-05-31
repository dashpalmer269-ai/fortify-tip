import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";
import { parseBody } from "@/lib/schemas/api";

/**
 * Step 1 of the document-upload flow: mint a signed upload URL.
 *
 * The browser PUTs the file directly to Supabase Storage (no server-bandwidth
 * tax). Path convention: {practice_id}/{control_id}/{uuid}-{filename}, which
 * also matches the storage.objects RLS policy on the `evidence` bucket.
 *
 * Auth: caller must be an admin of the practice the check belongs to.
 */
const UploadRequestSchema = z.object({
  evidence_check_id: z.string().uuid(),
  file_name: z.string().min(1).max(200),
  file_size: z.number().int().positive().max(50 * 1024 * 1024).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  assertActive(session);
  if (!isAdmin(session.membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(UploadRequestSchema, req);
  if (!parsed.ok) return parsed.response;
  const { evidence_check_id, file_name } = parsed.data;

  // Verify the check exists and resolve its control_id (used in the storage path)
  const { data: check } = await db
    .from("evidence_checks")
    .select("id, control_id, collection_method")
    .eq("id", evidence_check_id)
    .maybeSingle();
  if (!check) return NextResponse.json({ error: "Evidence check not found" }, { status: 404 });
  if (check.collection_method !== "document_upload") {
    return NextResponse.json(
      { error: "This check is not a document_upload type" },
      { status: 400 }
    );
  }

  // Sanitize filename — alphanum, dots, dashes, underscores only
  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
  const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
  const path = `${session.membership.practice_id}/${check.control_id}/${uniqueName}`;

  const { data: signed, error: signErr } = await db.storage
    .from("evidence")
    .createSignedUploadUrl(path);
  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? "Failed to create upload URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path,
    token: signed.token,
    signed_url: signed.signedUrl,
  });
}
