import Link from "next/link";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
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

export default async function PoliciesPage() {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const { data: policies } = await supabase
    .from("policies")
    .select("id, framework, policy_type, title, version, status, ai_generated, effective_date, next_review_date, updated_at")
    .eq("practice_id", session.membership.practice_id)
    .order("updated_at", { ascending: false });

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Documentation"
        title="Policies"
        description="HIPAA, SOC 2, and ISO require written policies covering security, incident response, access control, and more. Fortify drafts them with AI tailored to your practice; you review and approve."
        action={<DraftPolicyButton practiceId={session.membership.practice_id} />}
      />

      {!policies || policies.length === 0 ? (
        <EmptyState
          title="No policies yet"
          description="Click 'Draft a policy' above to generate your first one from the HIPAA template library."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {(policies as PolicyRow[]).map((p) => (
              <Link key={p.id} href={`/app/policies/${p.id}`} className="block">
                <div className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-[var(--color-surface-raised)] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[var(--color-primary)] text-sm font-medium truncate">{p.title}</p>
                      {p.ai_generated && <Badge variant="accent">AI draft</Badge>}
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)]">
                      {p.framework ?? "cross-framework"} · v{p.version} · updated{" "}
                      {new Date(p.updated_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <Badge variant={p.status === "active" ? "success" : p.status === "draft" ? "warning" : "muted"}>
                    {p.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
