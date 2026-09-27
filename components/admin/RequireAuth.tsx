"use client";

import { useRouter } from "next/navigation";
import { useUserRole } from "@/lib/useUserRole";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, role } = useUserRole();

  if (role === undefined) {
    return <p className="max-w-5xl mx-auto p-6 text-sm text-muted">Loading…</p>;
  }

  if (session === null) {
    router.replace("/admin/login");
    return null;
  }

  if (role !== "admin") {
    return (
      <p className="max-w-5xl mx-auto p-6 text-sm text-muted">
        This area is admin-only. Signed in as a {role === "contributor" ? "contributor" : "user with no assigned role"}.
      </p>
    );
  }

  return <>{children}</>;
}
