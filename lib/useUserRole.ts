"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { UserAppRole } from "./types";

/**
 * Client-side session + app role (admin/contributor). Role is undefined
 * while loading, null once loaded if the user has no user_roles row (should
 * not normally happen -- every account is created with one manually).
 */
export function useUserRole(): { session: Session | null; role: UserAppRole | null | undefined } {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserAppRole | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    async function loadRole(s: Session | null) {
      if (!s) {
        if (active) setRole(null);
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id).maybeSingle();
      if (active) setRole((data?.role as UserAppRole | undefined) ?? null);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadRole(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadRole(newSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, role };
}
