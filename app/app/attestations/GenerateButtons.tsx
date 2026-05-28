"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function GenerateButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(type: "hipaa_sra" | "soc2_readiness") {
    setBusy(type);
    setError(null);
    try {
      const res = await fetch("/api/attestations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Generation failed");
        return;
      }
      router.push(`/app/attestations/${body.id}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button onClick={() => generate("hipaa_sra")} loading={busy === "hipaa_sra"} variant="primary" size="md">
        Generate HIPAA Risk Assessment
      </Button>
      <Button onClick={() => generate("soc2_readiness")} loading={busy === "soc2_readiness"} variant="secondary" size="md">
        Generate SOC 2 Readiness Report
      </Button>
      {error && <p className="text-[13px] text-[var(--color-danger)] self-center">{error}</p>}
    </div>
  );
}
