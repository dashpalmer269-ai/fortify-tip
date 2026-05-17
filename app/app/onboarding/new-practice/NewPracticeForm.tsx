"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

const SIZE_OPTIONS = [
  { value: "solo", label: "Solo practitioner", help: "Just me" },
  { value: "small", label: "Small practice", help: "2–10 staff" },
  { value: "medium", label: "Mid-sized practice", help: "11–50 staff" },
  { value: "large", label: "Large practice", help: "50+ staff" },
] as const;

const PRACTICE_TYPES = [
  { value: "medical", label: "Medical / primary care" },
  { value: "dental", label: "Dental" },
  { value: "therapy", label: "Therapy / mental health" },
  { value: "specialty", label: "Specialty (cardio, derm, etc.)" },
  { value: "msp", label: "Healthcare MSP / IT provider" },
] as const;

const FRAMEWORK_OPTIONS = [
  { code: "HIPAA", label: "HIPAA", required: true, help: "Required for all US healthcare" },
  { code: "SOC2", label: "SOC 2", required: false, help: "Often requested by enterprise partners" },
  { code: "ISO27001", label: "ISO 27001", required: false, help: "International equivalent" },
  { code: "GDPR", label: "GDPR", required: false, help: "Required if any EU patients" },
];

export default function NewPracticeForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sizeTier, setSizeTier] = useState<typeof SIZE_OPTIONS[number]["value"]>("small");
  const [practiceType, setPracticeType] = useState<typeof PRACTICE_TYPES[number]["value"]>("medical");
  const [frameworks, setFrameworks] = useState<string[]>(["HIPAA"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFramework(code: string, required: boolean) {
    if (required) return;
    setFrameworks((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session expired. Please sign in again.");
        return;
      }

      // 1. Create the practice
      const { data: practice, error: pErr } = await supabase
        .from("practices")
        .insert({
          name: name.trim(),
          size_tier: sizeTier,
          practice_type: practiceType,
          frameworks_enabled: frameworks,
          hipaa_covered_entity: true,
        })
        .select()
        .single();
      if (pErr || !practice) {
        setError(pErr?.message ?? "Could not create the practice.");
        return;
      }

      // 2. Add the current user as owner
      const { error: puErr } = await supabase.from("practice_users").insert({
        practice_id: practice.id,
        user_id: user.id,
        role: "owner",
      });
      if (puErr) {
        setError(puErr.message);
        return;
      }

      // 3. Pre-create practice_controls rows for every healthcare-baseline control,
      //    so the dashboard has rows to score against from day one.
      const { data: baselineControls } = await supabase
        .from("controls")
        .select("id")
        .eq("healthcare_baseline", true);
      if (baselineControls?.length) {
        await supabase.from("practice_controls").insert(
          baselineControls.map((c) => ({
            practice_id: practice.id,
            control_id: c.id,
            status: "not_started" as const,
          }))
        );
      }

      router.push("/app/onboarding/invite-team");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 mb-1.5 block">Practice name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cedar Park Family Medicine"
          maxLength={120}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">Practice type</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRACTICE_TYPES.map((t) => (
            <label
              key={t.value}
              className={`glass-card cursor-pointer rounded-lg px-3 py-2.5 text-sm transition-all ${
                practiceType === t.value
                  ? "ring-2 ring-violet-400 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <input
                type="radio"
                name="practice_type"
                value={t.value}
                checked={practiceType === t.value}
                onChange={() => setPracticeType(t.value)}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">Practice size</label>
        <div className="grid grid-cols-2 gap-2">
          {SIZE_OPTIONS.map((s) => (
            <label
              key={s.value}
              className={`glass-card cursor-pointer rounded-lg px-3 py-2.5 text-sm transition-all ${
                sizeTier === s.value
                  ? "ring-2 ring-violet-400 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <input
                type="radio"
                name="size_tier"
                value={s.value}
                checked={sizeTier === s.value}
                onChange={() => setSizeTier(s.value)}
                className="sr-only"
              />
              <div className="font-medium">{s.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.help}</div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">Frameworks to track</label>
        <div className="space-y-2">
          {FRAMEWORK_OPTIONS.map((f) => {
            const checked = frameworks.includes(f.code);
            return (
              <label
                key={f.code}
                className={`glass-card flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-all ${
                  checked ? "ring-2 ring-violet-400" : ""
                } ${f.required ? "opacity-90 cursor-default" : "hover:bg-white/5"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={f.required}
                  onChange={() => toggleFramework(f.code, f.required)}
                  className="accent-violet-500 w-4 h-4"
                />
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">
                    {f.label}
                    {f.required && (
                      <span className="ml-2 text-xs text-violet-400 uppercase tracking-wider">required</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{f.help}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-gray-600">
        Signed in as <span className="text-gray-400">{userEmail}</span>. You&apos;ll be the owner of this practice.
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-3 transition-colors"
        style={{ boxShadow: "0 0 24px rgba(139,92,246,0.4)" }}
      >
        {loading ? "Creating practice…" : "Create practice → next step"}
      </button>
    </form>
  );
}
