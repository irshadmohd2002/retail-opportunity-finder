"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { OutletSummary } from "@/app/layout";

interface SidebarProps {
  outlets: OutletSummary[];
}

export default function Sidebar({ outlets }: SidebarProps) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const currentOutlet = outlets.find((o) => o.id === params?.id) ?? null;

  const [state, setState] = useState(currentOutlet?.state ?? "");
  const [district, setDistrict] = useState(currentOutlet?.district ?? "");

  const states = useMemo(
    () => Array.from(new Set(outlets.map((o) => o.state).filter((s): s is string => !!s))).sort(),
    [outlets]
  );

  const districts = useMemo(
    () =>
      Array.from(
        new Set(
          outlets
            .filter((o) => o.state === state)
            .map((o) => o.district)
            .filter((d): d is string => !!d)
        )
      ).sort(),
    [outlets, state]
  );

  const outletsInDistrict = useMemo(
    () =>
      outlets
        .filter((o) => o.state === state && o.district === district)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [outlets, state, district]
  );

  return (
    <aside className="w-full md:w-[260px] md:sticky md:top-0 md:h-screen shrink-0 bg-navy-deep text-white flex flex-col">
      <div className="px-5 py-5 border-b border-white/15">
        <span className="font-serif-display font-semibold text-lg leading-tight block">
          Retail Opportunity Finder
        </span>
        <span className="text-xs text-white/60">Non-fuel format recommendations</span>
      </div>

      <div className="px-5 py-5 flex flex-col gap-4">
        <DrillField label="State">
          <select
            className="drill-select"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setDistrict("");
            }}
          >
            <option value="">Select state…</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </DrillField>

        <DrillField label="District">
          <select
            className="drill-select"
            value={district}
            disabled={!state}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="">Select district…</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </DrillField>

        <DrillField label="Outlet">
          <select
            className="drill-select"
            value={currentOutlet?.id ?? ""}
            disabled={!district}
            onChange={(e) => {
              if (e.target.value) router.push(`/outlets/${e.target.value}`);
            }}
          >
            <option value="">Select outlet…</option>
            {outletsInDistrict.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.area ? ` — ${o.area}` : ""}
              </option>
            ))}
          </select>
        </DrillField>
      </div>

      <div className="mt-auto px-5 py-4 border-t border-white/15 text-xs text-white/60 flex flex-col gap-2">
        <a href="/admin" className="hover:text-white transition-colors">
          Admin: manage data
        </a>
        <span>Sample/illustrative data — not verified</span>
      </div>

      <style>{`
        .drill-select {
          width: 100%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 4px;
          padding: 8px 10px;
          font-size: 0.875rem;
          color: white;
        }
        .drill-select:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .drill-select option {
          color: #1b2027;
        }
      `}</style>
    </aside>
  );
}

function DrillField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-white/50">{label}</span>
      {children}
    </label>
  );
}
