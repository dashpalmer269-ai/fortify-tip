"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/browser";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        router.push("/app/onboarding/new-practice");
        router.refresh();
      } else {
        setConfirmSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (confirmSent) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-3">Almost there</p>
          <h1 className="font-display text-3xl text-[var(--color-primary)] mb-3" style={{ letterSpacing: "-0.02em" }}>
            Check your inbox
          </h1>
          <p className="text-sm text-[var(--color-secondary)]">
            We sent a verification link to{" "}
            <span className="text-[var(--color-primary)] font-mono">{email}</span>.
            Click it to finish creating your account.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="py-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-2">Get started</p>
        <h1 className="font-display text-3xl text-[var(--color-primary)] mb-2" style={{ letterSpacing: "-0.02em" }}>
          Begin a trial
        </h1>
        <p className="text-[13px] text-[var(--color-tertiary)] mb-7">14 days free · no credit card</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Work email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              autoComplete="email"
            />
          </Field>
          <Field label="Password" hint="12 characters minimum">
            <input
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              autoComplete="new-password"
            />
          </Field>

          {error && (
            <div className="text-[13px] text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} variant="primary" size="lg" className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-8 text-[13px] text-[var(--color-tertiary)] text-center">
          Already a Fortify user?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors">
            Sign in
          </Link>
        </p>
      </CardBody>

      <style>{`
        .auth-input {
          width: 100%;
          background: transparent;
          border: 1px solid var(--color-border-default);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--color-primary);
          font-size: 14px;
          transition: border-color 150ms ease;
        }
        .auth-input:focus { border-color: var(--color-accent); outline: none; }
      `}</style>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)]">{label}</label>
        {hint && <span className="text-[10px] text-[var(--color-quaternary)] font-mono">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
