import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";

export async function POST(request: Request) {
  const supabase = await createAuthedServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
