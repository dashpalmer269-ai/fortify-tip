import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const { data: policy } = await supabase
    .from("policies")
    .select("*")
    .eq("id", id)
    .eq("practice_id", session.membership.practice_id)
    .maybeSingle();
  if (!policy) notFound();

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/app/policies" className="text-xs text-gray-500 hover:text-white">
          ← Back to policies
        </Link>
      </div>

      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">
              {policy.framework ?? "Cross-framework"} policy · v{policy.version}
            </p>
            <h1 className="text-2xl font-bold text-white">{policy.title}</h1>
          </div>
          {policy.ai_generated && (
            <span className="text-[10px] uppercase tracking-wider text-violet-300 px-2 py-1 rounded-full bg-violet-500/15 shrink-0">
              AI-generated draft
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Status: <span className="capitalize">{policy.status}</span> · Last updated{" "}
          {new Date(policy.updated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      <article className="glass-card rounded-2xl p-8 prose-invert text-gray-200 leading-relaxed whitespace-pre-wrap">
        {policy.content_markdown}
      </article>

      <div className="mt-6 rounded-xl bg-violet-500/5 border border-violet-500/20 px-4 py-3 text-xs text-gray-500">
        Markdown rendering and acknowledgment tracking land in the next iteration. For now, this view shows the raw draft so a compliance officer can copy it into Word, edit, and re-import.
      </div>
    </div>
  );
}
