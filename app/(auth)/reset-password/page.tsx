"use client";
import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/update-password` : undefined,
      });
      if (error) setError(error.message);
      else setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Reset link sent</h1>
        <p className="text-sm text-gray-400">
          If an account exists for <span className="text-white">{email}</span>, you&apos;ll receive a password-reset link shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Reset your password</h1>
      <p className="text-sm text-gray-400 mb-6">We&apos;ll email you a secure reset link.</p>

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

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-500 text-center">
        <Link href="/login" className="text-violet-400 hover:text-violet-300">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
