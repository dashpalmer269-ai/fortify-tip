"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/browser";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const MIN_PASSWORD_LENGTH = 12;
type AccountType = "admin" | "employee";

export default function SignupPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => {
    const ok =
      email.includes("@") &&
      password.length >= MIN_PASSWORD_LENGTH &&
      password === verifyPassword;
    return { ok };
  }, [email, password, verifyPassword]);

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!validation.ok) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, account_type: accountType }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Signup failed");
        return;
      }
      router.push(`/auth/verify-sent?email=${encodeURIComponent(email)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback?account_type=${accountType}`
              : undefined,
          queryParams: { account_type: accountType },
        },
      });
      if (error) setError(error.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Card>
      <CardBody className="py-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-2">
          Get started
        </p>
        <h1 className="font-display text-3xl text-[var(--color-primary)] mb-2" style={{ letterSpacing: "-0.02em" }}>
          Create your account
        </h1>
        <p className="text-[13px] text-[var(--color-tertiary)] mb-7">
          Five-minute onboarding · cancel any time
        </p>

        {/* Account type selector */}
        <div className="mb-6">
          <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-2 block">
            I am signing up as
          </label>
          <div className="grid grid-cols-2 gap-2">
            <AccountTypeCard
              selected={accountType === "admin"}
              onClick={() => setAccountType("admin")}
              title="Administrator"
              body="Owner, manager, or compliance lead setting up a practice."
            />
            <AccountTypeCard
              selected={accountType === "employee"}
              onClick={() => setAccountType("employee")}
              title="Standard"
              body="Joining a practice that already uses Fortify."
            />
          </div>
        </div>

        {/* Google SSO */}
        <button
          onClick={handleGoogleSignup}
          disabled={googleLoading || loading}
          className="w-full h-11 flex items-center justify-center gap-2.5 border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] rounded-lg text-sm text-[var(--color-primary)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
        >
          {googleLoading ? (
            "Redirecting to Google…"
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        <div className="flex items-center gap-3 my-6">
          <span className="flex-1 h-px bg-[var(--color-border-subtle)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-quaternary)]">
            or with email
          </span>
          <span className="flex-1 h-px bg-[var(--color-border-subtle)]" />
        </div>

        <form onSubmit={handleEmailSignup} className="space-y-5">
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
          <Field label="Create password" hint={`${MIN_PASSWORD_LENGTH}+ characters`}>
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              autoComplete="new-password"
            />
          </Field>
          <Field
            label="Verify password"
            hint={
              verifyPassword && password !== verifyPassword
                ? "Doesn't match"
                : verifyPassword && password === verifyPassword
                ? "Match ✓"
                : ""
            }
          >
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              className={`auth-input ${
                verifyPassword && password !== verifyPassword ? "auth-input-error" : ""
              }`}
              autoComplete="new-password"
            />
          </Field>

          {error && (
            <div className="text-[13px] text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            disabled={!validation.ok}
            variant="primary"
            size="lg"
            className="w-full"
          >
            Create Account
          </Button>
        </form>

        <p className="mt-8 text-[13px] text-[var(--color-tertiary)] text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors">
            Sign in
          </Link>
        </p>

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
          .auth-input-error { border-color: var(--color-danger); }
        `}</style>
      </CardBody>
    </Card>
  );
}

function AccountTypeCard({
  selected,
  onClick,
  title,
  body,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-lg border transition-all ${
        selected
          ? "border-violet-400/60 bg-violet-500/10"
          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
      }`}
      style={selected ? { boxShadow: "0 0 16px rgba(139,92,246,0.25)" } : undefined}
    >
      <p className="text-sm font-semibold text-[var(--color-primary)] mb-1">{title}</p>
      <p className="text-[11px] text-[var(--color-tertiary)] leading-relaxed">{body}</p>
    </button>
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

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.3 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.3 29.3 4.5 24 4.5c-7.7 0-14.4 4.3-17.7 10.6z"/>
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-1.8 13.5-5l-6.2-5.1c-2.1 1.4-4.7 2.2-7.3 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.3 39.2 16 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.1c-.4.4 6.7-4.9 6.7-14.6 0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
