import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";

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
    <div className="px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">People</p>
          <h1 className="text-3xl font-bold text-white">Team</h1>
          <p className="text-sm text-gray-500 mt-2">
            Practice members and their compliance access roles.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] border-b border-white/[0.05] text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">User ID</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {(members as TeamRow[] | null ?? []).map((m) => (
              <tr key={m.user_id}>
                <td className="px-4 py-3 text-xs font-mono text-gray-400">
                  {m.user_id === session.user.id ? (
                    <span className="text-violet-300">{m.user_id.slice(0, 8)}… (you)</span>
                  ) : (
                    `${m.user_id.slice(0, 8)}…`
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-white capitalize">
                  {m.role.replace("_", " ")}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(m.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl bg-violet-500/5 border border-violet-500/20 px-4 py-3 text-xs text-gray-400">
        Email-based team invitations land in Phase E once the transactional email provider is wired up.
      </div>
    </div>
  );
}
