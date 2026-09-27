"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) router.replace("/admin/login");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) router.replace("/admin/login");
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (session === undefined) {
    return <p className="max-w-5xl mx-auto p-6 text-sm text-muted">Loading…</p>;
  }

  if (!session) return null;

  return <>{children}</>;
}
