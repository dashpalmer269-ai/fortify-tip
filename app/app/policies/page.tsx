import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import DraftPolicyButton from "./DraftPolicyButton";

export const dynamic = "force-dynamic";

interface PolicyRow {
  id: string;
  framework: string | null;
  policy_type: string;
  title: string;
  version: number;
  status: string;
  ai_generated: boolean;
  effective_date: string | null;
  next_review_date: string | null;
  updated_at: string;
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  draft:    { color: "#eab308", bg: "rgba(234,179,8,0.15)",  label: "Draft" },
  active:   { color: "#10b981", bg: "rgba(16,185,129,0.15)", label: "Active" },
  archived: { color: "#6b7280", bg: "rgba(107,114,128,0.15)", label: "Archived" },
};

export default async function PoliciesPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const { data: policies } = await supabase
    .from("policies")
    .select("id, framework, policy_type, title, version, status, ai_generated, effective_date, next_review_date, updated_at")
    .eq("practice_id", session.membership.practice_id)
    .order("updated_at", { ascending: false });

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Documentation</p>
          <h1 className="text-3xl font-bold text-white">Policies</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">
            HIPAA, SOC 2, and ISO require written policies covering security, incident response, access control, and more. Fortify drafts them with AI tailored to your practice — you review, approve, and your team acknowledges.
          </p>
        </div>
        <DraftPolicyButton practiceId={session.membership.practice_id} />
      </div>

      {(!policies || policies.length === 0) ? (
        <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
          No policies yet. Click <span className="text-white">Draft a policy</span> above to generate your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {(policies as PolicyRow[]).map((p) => {
            const sm = STATUS_META[p.status] ?? STATUS_META.draft;
            return (
              <Link
                key={p.id}
                href={`/app/policies/${p.id}`}
                className="glass-card rounded-xl p-5 hover:bg-white/[0.02] transition-colors block"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium truncate">{p.title}</p>
                      {p.ai_generated && (
                        <span className="text-[10px] uppercase tracking-wider text-violet-300 px-1.5 py-0.5 rounded bg-violet-500/15 shrink-0">
                          AI draft
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {p.framework ?? "cross-framework"} · {p.policy_type.replace(/_/g, " ")} · v{p.version} · updated{" "}
                      {new Date(p.updated_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ color: sm.color, background: sm.bg }}
                  >
                    {sm.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
