"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/browser";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody className="py-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-2">Welcome back</p>
        <h1 className="font-display text-3xl text-[var(--color-primary)] mb-8" style={{ letterSpacing: "-0.02em" }}>
          Sign in
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              autoComplete="email"
            />
          </Field>
          <Field
            label="Password"
            rightLabel={
              <Link href="/reset-password" className="text-[11px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] font-mono tracking-wider uppercase">
                Forgot
              </Link>
            }
          >
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              autoComplete="current-password"
            />
          </Field>

          {error && (
            <div className="text-[13px] text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} variant="primary" size="lg" className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-8 text-[13px] text-[var(--color-tertiary)] text-center">
          No account yet?{" "}
          <Link href="/signup" className="text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors">
            Begin a trial →
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
        .auth-input:focus {
          border-color: var(--color-accent);
          outline: none;
        }
      `}</style>
    </Card>
  );
}

function Field({ label, rightLabel, children }: { label: string; rightLabel?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)]">{label}</label>
        {rightLabel}
      </div>
      {children}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
