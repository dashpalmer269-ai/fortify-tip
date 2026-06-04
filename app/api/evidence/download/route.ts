import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";

/**
 * Generates a short-lived signed URL for an uploaded evidence file. The
 * caller must be a member of the practice whose ID prefixes the storage
 * path; otherwise the request is rejected before Supabase Storage is
 * touched.
 *
 * Path format (set by /api/evidence/finalize):
 *   {practice_id}/{control_id}/{timestamp}-{uuid}-{filename}
 *
 * Lifetime: 60 seconds — enough for the browser to fetch it, short
 * enough that a leaked URL is useless.
 */
export async function GET(req: NextRequest) {
  const session = await getAppSession();
  if (session.kind !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  // The storage-objects RLS policy already enforces practice-membership
  // on read. This explicit check is defense-in-depth + a clearer error
  // for the caller.
  if (!path.startsWith(`${session.membership.practice_id}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error } = await db.storage
    .from("evidence")
    .createSignedUrl(path, 60);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ signed_url: data.signedUrl });
}
