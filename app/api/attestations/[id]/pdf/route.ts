import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { buildAttestationPdf, type AttestationPdfInput } from "@/lib/pdf/attestation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Native PDF download for a formal attestation (HIPAA SRA / SOC 2
 * readiness). Byte-consistent server-side generation; the print view stays
 * available for wet-ink signing workflows.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createAuthedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No practice" }, { status: 403 });

  const { data: att } = await supabase
    .from("attestations")
    .select("*")
    .eq("id", id)
    .eq("practice_id", membership.practice_id)
    .maybeSingle();
  if (!att) return NextResponse.json({ error: "Attestation not found" }, { status: 404 });

  const pdf = await buildAttestationPdf(att as unknown as AttestationPdfInput);
  const kind = att.type === "hipaa_sra" ? "hipaa-sra" : "soc2-readiness";
  const generatedDate = new Date(att.generated_at).toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fortify-${kind}-${generatedDate}-${att.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
