import Link from "next/link";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();

  const [modulesRes, completionsRes] = await Promise.all([
    supabase
      .from("training_modules")
      .select("id, module_type, title, description, duration_minutes")
      .eq("active", true)
      .order("module_type", { ascending: true }),
    supabase
      .from("training_completions")
      .select("module_id, completed_at, expires_on")
      .eq("user_id", session.user.id)
      .order("completed_at", { ascending: false }),
  ]);

  // Latest completion per module
  const latestByModule = new Map<string, { completed_at: string; expires_on: string | null }>();
  for (const c of completionsRes.data ?? []) {
    if (!c.completed_at) continue;
    if (!latestByModule.has(c.module_id)) {
      latestByModule.set(c.module_id, { completed_at: c.completed_at, expires_on: c.expires_on });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Workforce training"
        title="Training"
        description="Required HIPAA + security awareness training. Your completions are recorded with a one-year expiration and roll up into the practice's compliance posture."
      />

      <div className="space-y-2">
        {(modulesRes.data ?? []).map((m) => {
          const latest = latestByModule.get(m.id);
          const status: "current" | "expired" | "due" = !latest
            ? "due"
            : latest.expires_on && latest.expires_on < today
            ? "expired"
            : "current";
          return (
            <Card key={m.id} className="overflow-hidden">
              <Link
                href={`/app/training/${m.id}`}
                className="block px-5 py-4 hover:bg-[var(--color-surface-raised)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-[var(--color-primary)] font-medium text-sm">{m.title}</h3>
                      {status === "current" && <Badge variant="success">Current</Badge>}
                      {status === "expired" && <Badge variant="danger">Expired — retake</Badge>}
                      {status === "due" && <Badge variant="warning">Not yet completed</Badge>}
                    </div>
                    <p className="text-[12px] text-[var(--color-tertiary)] leading-relaxed mb-1.5">{m.description}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-quaternary)]">
                      ~{m.duration_minutes} min · {m.module_type.replace(/_/g, " ")}
                      {latest && (
                        <>
                          {" · last completed "}
                          {new Date(latest.completed_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                          {latest.expires_on && ` · expires ${latest.expires_on}`}
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-[var(--color-accent)] text-sm shrink-0">Take →</span>
                </div>
              </Link>
            </Card>
          );
        })}

        {(modulesRes.data ?? []).length === 0 && (
          <Card className="py-12 text-center text-sm text-[var(--color-tertiary)]">
            No training modules are configured yet. Contact your administrator.
          </Card>
        )}
      </div>
    </div>
  );
}
