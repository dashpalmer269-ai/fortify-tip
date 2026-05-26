import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { NotificationsActionSchema, parseBody } from "@/lib/schemas/api";

// GET /api/notifications → latest 20 + unread count
export async function GET() {
  const auth = await createAuthedServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ items: [], unread: 0 });

  const { data: items } = await db
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const unread = (items ?? []).filter((n) => !n.read_at).length;
  return NextResponse.json({ items: items ?? [], unread });
}

// POST /api/notifications  body: { mark_all_read?: true, ids?: string[] }
export async function POST(req: NextRequest) {
  const auth = await createAuthedServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(NotificationsActionSchema, req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const now = new Date().toISOString();
  if (body.mark_all_read) {
    await db
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
  } else if (body.ids?.length) {
    await db
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .in("id", body.ids);
  }

  return NextResponse.json({ ok: true });
}
