import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import TeamClient from "./TeamClient";
import type { Role } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export interface TeamMember {
  user_id: string;
  email: string;
  role: Role;
  joined_at: string;
  is_self: boolean;
}

export default async function TeamPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const { data: members } = await supabase
    .from("practice_users")
    .select("user_id, role, created_at")
    .eq("practice_id", session.membership.practice_id)
    .order("created_at", { ascending: true });

  // Resolve user_id → email via service role
  const service = createServiceClient();
  const emailByUserId = new Map<string, string>();
  if (service && members?.length) {
    const { data: list } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of list?.users ?? []) {
      emailByUserId.set(u.id, u.email ?? "—");
    }
  }

  const teamMembers: TeamMember[] = (members ?? []).map((m) => ({
    user_id: m.user_id,
    email: emailByUserId.get(m.user_id) ?? "—",
    role: m.role as Role,
    joined_at: m.created_at,
    is_self: m.user_id === session.user.id,
  }));

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="People"
        title="Team"
        description="Members of this practice and their compliance access roles. Owner and Admin can add, remove, or change roles."
      />

      <TeamClient
        practiceId={session.membership.practice_id}
        currentRole={session.membership.role as Role}
        members={teamMembers}
      />
    </div>
  );
}
