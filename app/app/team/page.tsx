import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

interface TeamRow {
  user_id: string;
  role: string;
  created_at: string;
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

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="People"
        title="Team"
        description="Practice members and their compliance access roles."
      />

      <Card className="overflow-hidden">
        <div className="grid items-center gap-4 px-5 py-3 border-b border-[var(--color-border-subtle)] font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)]"
             style={{ gridTemplateColumns: "1fr 1fr 100px" }}>
          <div>User</div>
          <div>Role</div>
          <div className="text-right">Joined</div>
        </div>
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {(members as TeamRow[] | null ?? []).map((m) => (
            <div
              key={m.user_id}
              className="grid items-center gap-4 px-5 py-3 hover:bg-[var(--color-surface-raised)] transition-colors"
              style={{ gridTemplateColumns: "1fr 1fr 100px" }}
            >
              <span className="font-mono text-xs text-[var(--color-tertiary)]">
                {m.user_id === session.user.id ? (
                  <span className="text-[var(--color-primary)]">{m.user_id.slice(0, 8)}… <Badge variant="accent">you</Badge></span>
                ) : (
                  `${m.user_id.slice(0, 8)}…`
                )}
              </span>
              <span className="text-sm text-[var(--color-primary)] capitalize">
                {m.role.replace("_", " ")}
              </span>
              <span className="font-mono text-xs text-[var(--color-tertiary)] text-right">
                {new Date(m.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <p className="mt-6 text-xs text-[var(--color-quaternary)] font-mono">
        Email-based team invitations activate when the Resend API key is configured.
      </p>
    </div>
  );
}
