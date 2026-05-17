"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/browser";

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
      // If email confirmations are required by the project, the user gets a
      // verification link. Otherwise they're already signed in.
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
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
            <polyline points="22 6 12 13 2 6" />
            <rect x="2" y="4" width="20" height="16" rx="2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-sm text-gray-400">
          We sent a verification link to <span className="text-white">{email}</span>. Click it to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <div
      className="glass-card rounded-2xl p-8"
      style={{ boxShadow: "0 0 24px rgba(139,92,246,0.18)" }}
    >
      <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
      <p className="text-sm text-gray-400 mb-6">14-day free trial. No credit card required.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-gray-500 mb-1.5 block">Work email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-gray-500 mb-1.5 block">
            Password <span className="text-gray-700">· 12+ characters</span>
          </label>
          <input
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
          style={{ boxShadow: "0 0 20px rgba(139,92,246,0.4)" }}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-500 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-violet-400 hover:text-violet-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
