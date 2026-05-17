"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const POLICY_TEMPLATES = [
  { policy_type: "security_management", title: "Information Security Management Policy", framework: "HIPAA" },
  { policy_type: "access_control",      title: "Access Control & User Authentication Policy", framework: "HIPAA" },
  { policy_type: "incident_response",   title: "Security Incident Response Plan", framework: "HIPAA" },
  { policy_type: "workforce_training",  title: "Workforce Security Awareness Training Policy", framework: "HIPAA" },
  { policy_type: "encryption",          title: "Data Encryption Policy (At Rest & In Transit)", framework: "HIPAA" },
  { policy_type: "backup_recovery",     title: "Backup & Disaster Recovery Policy", framework: "HIPAA" },
  { policy_type: "vendor_management",   title: "Business Associate & Vendor Management Policy", framework: "HIPAA" },
  { policy_type: "audit_logging",       title: "Audit Logging & Monitoring Policy", framework: "HIPAA" },
  { policy_type: "acceptable_use",      title: "Acceptable Use of Information Systems Policy", framework: "HIPAA" },
];

export default function DraftPolicyButton({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

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
      if (!res.ok) { setErr(body.error ?? "Failed to draft."); return; }
      router.push(`/app/policies/${body.id}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative" ref={wrap}>
      <Button onClick={() => setOpen((s) => !s)} variant="primary" size="md">
        Draft a policy
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 surface-overlay rounded-lg p-1 z-30 max-h-96 overflow-y-auto animate-fade-in-fast">
          {POLICY_TEMPLATES.map((t) => (
            <button
              key={t.policy_type}
              onClick={() => draft(t)}
              disabled={loading !== null}
              className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[var(--color-surface-raised)] disabled:opacity-50 transition-colors"
            >
              <p className="text-[var(--color-primary)] text-[13px] font-medium leading-tight">{t.title}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)] mt-1">
                {loading === t.policy_type ? "Drafting with AI…" : `${t.framework} · ${t.policy_type.replace(/_/g, " ")}`}
              </p>
            </button>
          ))}
          {err && <div className="text-xs text-[var(--color-danger)] px-3 py-2">{err}</div>}
        </div>
      )}
    </div>
  );
}
