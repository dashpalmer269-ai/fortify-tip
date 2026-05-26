import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { marked } from "marked";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAppSession();
  assertActive(session);

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
          {policy.updated_at ? new Date(policy.updated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
        </p>
      </div>

      <article
        className="glass-card rounded-2xl p-8 text-gray-200 leading-relaxed policy-prose"
        dangerouslySetInnerHTML={{ __html: marked.parse(policy.content_markdown ?? "") }}
      />
      <style>{`
        .policy-prose h2 { font-family: var(--font-display); font-size: 22px; color: var(--color-primary); margin: 24px 0 8px; letter-spacing: -0.01em; }
        .policy-prose h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-tertiary); margin: 20px 0 6px; font-weight: 500; }
        .policy-prose p { font-size: 15px; color: var(--color-secondary); margin-bottom: 14px; }
        .policy-prose ol, .policy-prose ul { margin: 10px 0 16px 20px; color: var(--color-secondary); }
        .policy-prose li { margin-bottom: 6px; font-size: 14px; }
        .policy-prose strong { color: var(--color-primary); font-weight: 500; }
        .policy-prose code { font-family: var(--font-mono); font-size: 13px; background: var(--color-surface); padding: 1px 6px; border-radius: 4px; }
      `}</style>

      <div className="mt-6 rounded-xl surface px-4 py-3 text-xs text-[var(--color-tertiary)]">
        Acknowledgment tracking lands in the next iteration. Copy and export to Word still works for now.
      </div>
    </div>
  );
}
