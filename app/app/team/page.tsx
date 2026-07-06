import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import TeamClient from "./TeamClient";
import RequestsQueue, { type PendingRequest } from "./RequestsQueue";
import InvitesPanel, { type PendingInviteRow } from "./InvitesPanel";
import type { Role } from "@/lib/auth/permissions";
import { isAdmin } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export interface TeamMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  joined_at: string | null;
  is_self: boolean;
}

export default async function TeamPage() {
  const session = await getAppSession();
  assertActive(session);

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

  // Resolve user_id → full_name from user_profiles
  const nameByUserId = new Map<string, string>();
  if (service && members?.length) {
    const { data: profiles } = await service
      .from("user_profiles")
      .select("user_id, full_name")
      .in("user_id", members.map((m) => m.user_id));
    for (const p of profiles ?? []) {
      if (p.full_name) nameByUserId.set(p.user_id, p.full_name);
    }
  }

  const teamMembers: TeamMember[] = (members ?? []).map((m) => ({
    user_id: m.user_id,
    email: emailByUserId.get(m.user_id) ?? "—",
    full_name: nameByUserId.get(m.user_id) ?? null,
    role: m.role as Role,
    joined_at: m.created_at,
    is_self: m.user_id === session.user.id,
  }));

  // Outstanding email invitations (practice_invites, migration 048).
  // Soft-fail if the table doesn't exist yet so the page never breaks
  // between deploy and migration run.
  const role = session.membership.role as Role;
  let pendingInvites: PendingInviteRow[] = [];
  if (isAdmin(role) && service) {
    const { data: inviteRows } = await service
      .from("practice_invites")
      .select("id, email, role, created_at, expires_at")
      .eq("practice_id", session.membership.practice_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    pendingInvites = (inviteRows ?? []) as PendingInviteRow[];
  }

  // Pending join requests matched to this practice
  let pendingRequests: PendingRequest[] = [];
  if (isAdmin(role) && service) {
    const { data: reqRows } = await service
      .from("user_profiles")
      .select("user_id, full_name, job_title, phone, claimed_admin_name, primary_address, onboarded_at, status, account_type")
      .eq("matched_practice_id", session.membership.practice_id)
      .eq("status", "pending")
      .eq("account_type", "employee")
      .order("onboarded_at", { ascending: true });

    pendingRequests = (reqRows ?? []).map((r) => ({
      user_id: r.user_id,
      email: emailByUserId.get(r.user_id) ?? "—",
      full_name: r.full_name ?? "Unknown",
      job_title: r.job_title ?? "—",
      phone: r.phone,
      claimed_admin_name: r.claimed_admin_name,
      primary_address: (r.primary_address ?? {}) as Record<string, string>,
      requested_at: r.onboarded_at as string,
    }));
  }

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="People"
        title={isAdmin(role) ? "Edit Staff" : "Team"}
        description={
          isAdmin(role)
            ? "Approve pending requests, edit names, change roles, or offboard members of this practice."
            : "Members of this practice and their compliance access roles."
        }
      />

      {isAdmin(role) && (
        <RequestsQueue
          practiceName={session.membership.practice_name}
          requests={pendingRequests}
        />
      )}

      {isAdmin(role) && <InvitesPanel invites={pendingInvites} />}

      <TeamClient
        practiceId={session.membership.practice_id}
        currentRole={role}
        members={teamMembers}
      />
    </div>
  );
}
