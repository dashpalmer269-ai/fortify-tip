import { notFound } from "next/navigation";
import Link from "next/link";
import { renderMarkdown } from "@/lib/sanitize";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import CompleteButton from "./CompleteButton";

export const dynamic = "force-dynamic";

export default async function TrainingTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();

  const [moduleRes, latestRes] = await Promise.all([
    supabase
      .from("training_modules")
      .select("id, module_type, title, description, content_markdown, duration_minutes")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("training_completions")
      .select("completed_at, expires_on")
      .eq("module_id", id)
      .eq("user_id", session.user.id)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const module = moduleRes.data;
  if (!module) notFound();

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/app/training" className="text-xs text-gray-500 hover:text-white">
          ← Back to training
        </Link>
      </div>

      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-violet-400 mb-2">
          {module.module_type.replace(/_/g, " ")} · ~{module.duration_minutes ?? 15} min
        </p>
        <h1 className="text-2xl font-bold text-white mb-2">{module.title}</h1>
        <p className="text-sm text-[var(--color-secondary)]">{module.description}</p>
      </div>

      <article
        className="glass-card rounded-2xl p-8 text-gray-200 leading-relaxed training-prose"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(module.content_markdown) }}
      />

      <style>{`
        .training-prose h2 { font-family: var(--font-display); font-size: 22px; color: var(--color-primary); margin: 28px 0 10px; letter-spacing: -0.01em; }
        .training-prose h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-tertiary); margin: 22px 0 6px; font-weight: 500; }
        .training-prose p  { font-size: 15px; color: var(--color-secondary); margin-bottom: 14px; }
        .training-prose ol, .training-prose ul { margin: 10px 0 16px 22px; color: var(--color-secondary); }
        .training-prose li { margin-bottom: 6px; font-size: 14px; }
        .training-prose strong { color: var(--color-primary); font-weight: 500; }
      `}</style>

      <div className="mt-8">
        <CompleteButton
          moduleId={module.id}
          moduleTitle={module.title}
          initialCompletedAt={latestRes.data?.completed_at ?? null}
          initialExpiresOn={latestRes.data?.expires_on ?? null}
        />
      </div>
    </div>
  );
}
