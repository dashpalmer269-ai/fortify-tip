"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateReportButton({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practice_id: practiceId, report_type: "audit_readiness", framework: null }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErr(body.error ?? "Failed to generate report.");
        return;
      }
      router.push(`/app/reports/${body.id}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={go}
        disabled={loading}
        className="bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        style={{ boxShadow: "0 0 20px rgba(139,92,246,0.4)" }}
      >
        {loading ? "Generating with AI…" : "+ Generate report"}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
