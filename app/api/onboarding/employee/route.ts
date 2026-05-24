import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";

export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        full_name?: string;
        job_title?: string;
        phone?: string | null;
        pending_practice_name?: string;
        primary_address?: Record<string, string | null>;
      }
    | null;

  if (
    !body?.full_name?.trim() ||
    !body.job_title?.trim() ||
    !body.pending_practice_name?.trim() ||
    !body.primary_address
  ) {
    return NextResponse.json({ error: "Missing required profile fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        account_type: "employee",
        full_name: body.full_name.trim(),
        job_title: body.job_title.trim(),
        phone: body.phone?.trim() || null,
        pending_practice_name: body.pending_practice_name.trim(),
        primary_address: body.primary_address,
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
