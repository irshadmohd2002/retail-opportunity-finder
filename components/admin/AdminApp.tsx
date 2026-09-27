"use client";

import { useState } from "react";
import OutletsAdmin from "./OutletsAdmin";
import FormatEconomicsAdmin from "./FormatEconomicsAdmin";
import BrandPartnershipsAdmin from "./BrandPartnershipsAdmin";
import PhotosAdmin from "./PhotosAdmin";

const TABS = [
  { key: "outlets", label: "Outlets" },
  { key: "formats", label: "Format economics" },
  { key: "brands", label: "Brand partnerships" },
  { key: "photos", label: "Photos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminApp() {
  const [tab, setTab] = useState<TabKey>("outlets");

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="font-serif-display font-semibold text-2xl text-navy">Admin</h1>
        <p className="text-sm text-muted mt-1">Manage outlets, format economics, and brand partnership data.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2 border-b-2 -mb-px ${
              tab === t.key ? "border-navy text-navy font-medium" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "outlets" && <OutletsAdmin />}
      {tab === "formats" && <FormatEconomicsAdmin />}
      {tab === "brands" && <BrandPartnershipsAdmin />}
      {tab === "photos" && <PhotosAdmin />}
    </div>
  );
}
