"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const POLICY_TEMPLATES = [
  { policy_type: "security_management", title: "Information Security Management Policy", framework: "HIPAA" },
  { policy_type: "access_control", title: "Access Control & User Authentication Policy", framework: "HIPAA" },
  { policy_type: "incident_response", title: "Security Incident Response Plan", framework: "HIPAA" },
  { policy_type: "workforce_training", title: "Workforce Security Awareness Training Policy", framework: "HIPAA" },
  { policy_type: "encryption", title: "Data Encryption Policy (At Rest & In Transit)", framework: "HIPAA" },
  { policy_type: "backup_recovery", title: "Backup & Disaster Recovery Policy", framework: "HIPAA" },
  { policy_type: "vendor_management", title: "Business Associate & Vendor Management Policy", framework: "HIPAA" },
  { policy_type: "audit_logging", title: "Audit Logging & Monitoring Policy", framework: "HIPAA" },
  { policy_type: "acceptable_use", title: "Acceptable Use of Information Systems Policy", framework: "HIPAA" },
];

export default function DraftPolicyButton({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function draft(t: typeof POLICY_TEMPLATES[number]) {
    setLoading(t.policy_type);
    setErr(null);
    try {
      const res = await fetch("/api/policies/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practice_id: practiceId,
          policy_type: t.policy_type,
          title: t.title,
          framework: t.framework,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErr(body.error ?? "Failed to draft.");
        return;
      }
      router.push(`/app/policies/${body.id}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        style={{ boxShadow: "0 0 20px rgba(139,92,246,0.4)" }}
      >
        + Draft a policy
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 glass-card rounded-xl p-2 z-30 max-h-96 overflow-y-auto">
          {POLICY_TEMPLATES.map((t) => (
            <button
              key={t.policy_type}
              onClick={() => draft(t)}
              disabled={loading !== null}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.05] text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <p className="text-white text-xs font-medium">{t.title}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {loading === t.policy_type ? "Drafting with AI…" : `${t.framework} · ${t.policy_type.replace(/_/g, " ")}`}
              </p>
            </button>
          ))}
          {err && <div className="text-xs text-red-400 px-3 py-2">{err}</div>}
        </div>
      )}
    </div>
  );
}
