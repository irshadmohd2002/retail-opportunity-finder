"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { inputClassName } from "./fields";

async function redirectByRole(router: ReturnType<typeof useRouter>, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  router.replace(data?.role === "admin" ? "/admin" : "/");
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectByRole(router, data.session.user.id);
      else setCheckingSession(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.user) await redirectByRole(router, data.user.id);
  }

  if (checkingSession) return null;

  return (
    <div className="max-w-sm mx-auto p-6 flex flex-col gap-6 mt-16">
      <div>
        <h1 className="font-serif-display font-semibold text-2xl text-navy">Sign in</h1>
        <p className="text-sm text-muted mt-1">
          Admin: manage outlets and format data. Contributor: suggest edits for admin review.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            className={inputClassName}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            className={inputClassName}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="text-sm" style={{ color: "var(--navy)" }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="text-sm px-3 py-1.5 rounded-sm bg-navy text-white disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
