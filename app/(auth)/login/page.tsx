"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/browser";

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="glass-card rounded-2xl p-8"
      style={{ boxShadow: "0 0 24px rgba(139,92,246,0.18)" }}
    >
      <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
      <p className="text-sm text-gray-400 mb-6">Sign in to your Fortify account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-gray-500 mb-1.5 block">Email</label>
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs uppercase tracking-wider text-gray-500">Password</label>
            <Link href="/reset-password" className="text-xs text-violet-400 hover:text-violet-300">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
            autoComplete="current-password"
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-500 text-center">
        New to Fortify?{" "}
        <Link href="/signup" className="text-violet-400 hover:text-violet-300">
          Create an account
        </Link>
      </p>
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
