"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import OutletsAdmin from "./OutletsAdmin";
import FormatEconomicsAdmin from "./FormatEconomicsAdmin";
import BrandPartnershipsAdmin from "./BrandPartnershipsAdmin";
import PhotosAdmin from "./PhotosAdmin";
import ThemeSettingsAdmin from "./ThemeSettingsAdmin";
import SubmissionsAdmin from "./SubmissionsAdmin";
import CompetitionAdmin from "./CompetitionAdmin";

const TABS = [
  { key: "outlets", label: "Outlets" },
  { key: "formats", label: "Format economics" },
  { key: "competition", label: "Competition data" },
  { key: "brands", label: "Brand partnerships" },
  { key: "photos", label: "Photos" },
  { key: "theme", label: "Theme" },
  { key: "submissions", label: "Submissions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminApp() {
  const [tab, setTab] = useState<TabKey>("outlets");
  const [pendingCount, setPendingCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-serif-display font-semibold text-2xl text-navy">Admin</h1>
          <p className="text-sm text-muted mt-1">Manage outlets, format economics, and brand partnership data.</p>
        </div>
        <button onClick={handleSignOut} className="text-sm text-muted hover:underline">
          Sign out
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2 border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === t.key ? "border-navy text-navy font-medium" : "border-transparent text-muted"
            }`}
          >
            {t.label}
            {t.key === "submissions" && pendingCount > 0 && (
              <span className="text-xs bg-navy text-white rounded-full px-1.5 py-0.5 leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "outlets" && <OutletsAdmin />}
      {tab === "formats" && <FormatEconomicsAdmin />}
      {tab === "competition" && <CompetitionAdmin />}
      {tab === "brands" && <BrandPartnershipsAdmin />}
      {tab === "photos" && <PhotosAdmin />}
      {tab === "theme" && <ThemeSettingsAdmin />}
      {tab === "submissions" && <SubmissionsAdmin onCountChange={setPendingCount} />}
    </div>
  );
}
