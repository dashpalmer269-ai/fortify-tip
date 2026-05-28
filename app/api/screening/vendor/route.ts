import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { VendorScreeningSchema } from "@/lib/schemas/screening";
import { startPreliminary } from "@/lib/screening/service";
import { SCREENING_MESSAGES } from "@/lib/screening/user-message";
import { isAdmin } from "@/lib/auth/permissions";

/**
 * Screen a vendor contact at BAA addition time. Same flow as the workforce
 * preliminary screening, but subject_type is 'vendor_contact'. No expires_at —
 * we don't re-screen vendors automatically (BAA renewal triggers a new screening).
 *
 * Authorization: only admin/owner of the vendor's practice can run this.
 */
export async function POST(req: NextRequest) {
  const userClient = await createAuthedServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(VendorScreeningSchema, req, {
    phiFields: ["first_name", "last_name"],
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Look up the vendor, confirm caller is admin of its practice
  const { data: vendor } = await db
    .from("vendors")
    .select("id, practice_id")
    .eq("id", body.vendor_id)
    .maybeSingle();
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const { data: membership } = await db
    .from("practice_users")
    .select("role")
    .eq("practice_id", vendor.practice_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !isAdmin(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await startPreliminary(db, {
      subjectType: "vendor_contact",
      subjectVendorId: vendor.id,
      practiceId: vendor.practice_id,
      firstName: body.first_name,
      lastName: body.last_name,
      dateOfBirth: body.date_of_birth,
    });

    // Persist the contact DOB on the vendor row so re-screening on demand
    // doesn't require re-collecting it.
    await db
      .from("vendors")
      .update({
        contact_first_name: body.first_name,
        contact_last_name: body.last_name,
        contact_date_of_birth: body.date_of_birth,
      })
      .eq("id", vendor.id);

    if (result.status === "cleared") {
      return NextResponse.json(
        { screening_id: result.screeningId, status: "cleared" },
        { status: 201 }
      );
    }
    return NextResponse.json(
      {
        screening_id: result.screeningId,
        status: "review_required",
        prompt: {
          message: SCREENING_MESSAGES.reviewRequired,
          explanation: SCREENING_MESSAGES.reviewExplanation,
          fields: ["middle_name", "address_line", "city", "state", "zip"],
        },
      },
      { status: 202 }
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
