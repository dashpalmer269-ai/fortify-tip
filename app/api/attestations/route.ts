import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { z } from "zod";
import { isAdmin, type Role } from "@/lib/auth/permissions";
import { generateAttestation } from "@/lib/attestation/generate";
import { requirePracticeAccess } from "@/lib/billing/require-access";

export const maxDuration = 120;

const GenerateSchema = z.object({
  type: z.enum(["hipaa_sra", "soc2_readiness"]),
});

/** POST /api/attestations — generate a new attestation (admin/owner only). */
export async function POST(req: NextRequest) {
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(GenerateSchema, req);
  if (!parsed.ok) return parsed.response;

  const { data: membership } = await db
    .from("practice_users")
    .select("practice_id, role, practices(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()
    .returns<{ practice_id: string; role: Role; practices: { name: string } | null } | null>();
  if (!membership || !isAdmin(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guard = await requirePracticeAccess(db, membership.practice_id);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await generateAttestation(
      db,
      membership.practice_id,
      membership.practices?.name ?? "Practice",
      parsed.data.type,
      user.id
    );
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
