import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const practice = session.membership.practices as unknown as {
    id: string;
    name: string;
    frameworks_enabled: string[];
    hipaa_covered_entity: boolean;
  } | null;

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Account</p>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      <section className="glass-card rounded-2xl p-6 mb-4">
        <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Email</dt>
            <dd className="text-white">{session.user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Role</dt>
            <dd className="text-white capitalize">{session.membership.role.replace("_", " ")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Account created</dt>
            <dd className="text-white">
              {new Date(session.user.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}
            </dd>
          </div>
        </dl>
      </section>

      <section className="glass-card rounded-2xl p-6 mb-4">
        <h2 className="text-lg font-semibold text-white mb-4">Practice</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-white">{practice?.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Frameworks</dt>
            <dd className="flex flex-wrap gap-1.5 justify-end">
              {practice?.frameworks_enabled.map((f) => (
                <span
                  key={f}
                  className="text-xs text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded"
                >
                  {f}
                </span>
              ))}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">HIPAA covered entity</dt>
            <dd className="text-white">{practice?.hipaa_covered_entity ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Security</h2>
        <p className="text-sm text-gray-500 mb-4">
          Multi-factor authentication and password updates land in the next pass. Until then, use Supabase&apos;s built-in account recovery.
        </p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm border border-white/15 hover:border-red-400/40 text-white rounded-lg px-4 py-2 transition-colors"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
