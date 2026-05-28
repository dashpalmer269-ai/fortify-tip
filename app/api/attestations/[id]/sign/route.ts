import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/permissions";

const SignSchema = z.object({
  method: z.enum(["e_signature", "print_and_sign"]),
  signer_name: z.string().trim().min(2).max(120),
  signer_title: z.string().trim().min(2).max(120),
  // For e_signature, the signer must affirm the statement (checkbox → true).
  affirmed: z.boolean().optional(),
});

const ATTESTATION_STATEMENT =
  "I certify that I am authorized to attest on behalf of this practice, that I have reviewed this assessment, and that the information herein is accurate to the best of my knowledge as of the date signed.";

/**
 * Sign an attestation. Supports both paths:
 *   - e_signature: requires affirmed=true; records signer identity + IP + timestamp,
 *     flips status to 'signed'. Immutable thereafter.
 *   - print_and_sign: records that the practice intends to sign offline; still
 *     captures signer name/title and marks signed (the wet-ink copy is the
 *     legal artifact, this row is the system-of-record pointer).
 *
 * Admin/owner only. A signed attestation cannot be re-signed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(SignSchema, req, { phiFields: ["signer_name", "signer_title"] });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (body.method === "e_signature" && !body.affirmed) {
    return NextResponse.json(
      { error: "You must affirm the attestation statement to e-sign." },
      { status: 400 }
    );
  }

  const { data: att } = await db
    .from("attestations")
    .select("id, practice_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!att) return NextResponse.json({ error: "Attestation not found" }, { status: 404 });
  if (att.status === "signed") {
    return NextResponse.json({ error: "Already signed; generate a new attestation to re-attest." }, { status: 409 });
  }

  const { data: membership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", att.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !isAdmin(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const { error } = await db
    .from("attestations")
    .update({
      status: "signed",
      signed_by: user.id,
      signer_name: body.signer_name,
      signer_title: body.signer_title,
      signed_at: new Date().toISOString(),
      signature_method: body.method,
      signature_ip: body.method === "e_signature" ? ip : null,
      signature_statement: ATTESTATION_STATEMENT,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("audit_logs").insert({
    practice_id: att.practice_id,
    actor_user_id: user.id,
    action: "attestation.signed",
    resource_type: "attestation",
    resource_id: id,
    metadata: { method: body.method, signer_name: body.signer_name, signer_title: body.signer_title },
  });

  return NextResponse.json({ ok: true, status: "signed" });
}
