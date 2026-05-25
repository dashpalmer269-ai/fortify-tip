import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { draftPolicy } from "@/lib/ai/compliance-ai";
import { scanFieldsForPhi } from "@/lib/compliance/no-phi";

export const maxDuration = 60;

interface Body {
  practice_id?: string;
  framework?: string;
  policy_type?: string;
  title?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.practice_id || !body.policy_type || !body.title) {
    return NextResponse.json({ error: "practice_id, policy_type, and title required" }, { status: 400 });
  }

  const phi = scanFieldsForPhi({ title: body.title, policy_type: body.policy_type });
  if (phi) return NextResponse.json({ error: phi.message }, { status: 422 });

  const { data: practice } = await supabase
    .from("practices")
    .select("name, practice_type")
    .eq("id", body.practice_id)
    .single();
  if (!practice) return NextResponse.json({ error: "Practice not found" }, { status: 404 });

  let content = "";
  try {
    content = await draftPolicy({
      practice_name: practice.name,
      practice_type: practice.practice_type,
      framework: body.framework ?? "HIPAA",
      policy_type: body.policy_type,
      policy_title: body.title,
    });
  } catch (e) {
    return NextResponse.json({ error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  const { data: policy, error: insErr } = await supabase
    .from("policies")
    .insert({
      practice_id: body.practice_id,
      framework: body.framework ?? "HIPAA",
      policy_type: body.policy_type,
      title: body.title,
      content_markdown: content,
      status: "draft",
      ai_generated: true,
    })
    .select()
    .single();
  if (insErr || !policy) {
    return NextResponse.json({ error: insErr?.message ?? "insert failed" }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    practice_id: body.practice_id,
    actor_user_id: user.id,
    action: "policy.drafted_by_ai",
    resource_type: "policy",
    resource_id: policy.id,
    metadata: { title: body.title, framework: body.framework ?? "HIPAA" },
  });

  return NextResponse.json({ id: policy.id });
}
