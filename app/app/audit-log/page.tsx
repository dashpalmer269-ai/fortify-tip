import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

interface LogRow {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  actor_user_id: string | null;
  actor_service: string | null;
  ip_address: string | null;
  occurred_at: string;
}

export default async function AuditLogPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding");

  const supabase = await createAuthedServerClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("practice_id", session.membership.practice_id)
    .order("occurred_at", { ascending: false })
    .limit(200);

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Tamper-resistant trail"
        title="Audit log"
        description="Every change to controls, evidence, vendors, and team is recorded for SOC 2 CC7.2 and HIPAA §164.312(b). Most recent first."
      />

      {!logs || logs.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-[var(--color-tertiary)]">
            No events recorded yet. Compliance actions, evidence captures, and system drift detections will appear here as they happen.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid items-center gap-4 px-5 py-3 border-b border-[var(--color-border-subtle)] font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)]"
               style={{ gridTemplateColumns: "150px 90px 1fr 130px 1fr" }}>
            <div>Time</div>
            <div>Actor</div>
            <div>Action</div>
            <div>Resource</div>
            <div>Detail</div>
          </div>
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {(logs as LogRow[]).map((l) => (
              <div
                key={l.id}
                className="grid items-center gap-4 px-5 py-3 hover:bg-[var(--color-surface-raised)] transition-colors"
                style={{ gridTemplateColumns: "150px 90px 1fr 130px 1fr" }}
              >
                <span className="font-mono text-[11px] text-[var(--color-tertiary)] whitespace-nowrap">
                  {new Date(l.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className="text-xs">
                  {l.actor_service ? (
                    <Badge variant="accent">{l.actor_service}</Badge>
                  ) : (
                    <Badge variant="muted">user</Badge>
                  )}
                </span>
                <span className="text-sm text-[var(--color-primary)] truncate">{formatAction(l.action)}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)]">
                  {l.resource_type.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-[var(--color-tertiary)] truncate font-mono">
                  {l.metadata ? summarizeMetadata(l.metadata) : "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function formatAction(a: string): string {
  return a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function summarizeMetadata(m: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      parts.push(`${k}=${v}`);
    } else {
      parts.push(`${k}=[${typeof v}]`);
    }
    if (parts.length >= 3) break;
  }
  return parts.join(" · ");
}
