import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";

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
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const supabase = await createAuthedServerClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("practice_id", session.membership.practice_id)
    .order("occurred_at", { ascending: false })
    .limit(200);

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Tamper-resistant trail</p>
        <h1 className="text-3xl font-bold text-white">Audit log</h1>
        <p className="text-sm text-gray-500 mt-2">
          Every change made to controls, evidence, vendors, and team is recorded here for SOC 2 CC7.2 and HIPAA §164.312(b). Most recent first.
        </p>
      </div>

      {(!logs || logs.length === 0) ? (
        <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
          No events recorded yet. Compliance actions, evidence captures, and system drift detections will appear here as they happen.
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/[0.05] text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {(logs as LogRow[]).map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(l.occurred_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.actor_service ? (
                      <span className="text-violet-300">{l.actor_service}</span>
                    ) : (
                      <span className="text-gray-300">user</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-white font-medium">{formatAction(l.action)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{l.resource_type}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {l.metadata ? summarizeMetadata(l.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
