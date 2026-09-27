"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { OutletSummary } from "@/app/layout";
import { supabase } from "@/lib/supabase";
import { useUserRole } from "@/lib/useUserRole";
import SuggestEditModal, { type SuggestEditField } from "./SuggestEditModal";

interface SidebarProps {
  outlets: OutletSummary[];
  omcs: { id: number; name: string }[];
}

export default function Sidebar({ outlets, omcs }: SidebarProps) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const currentOutlet = outlets.find((o) => o.id === params?.id) ?? null;
  const { session, role } = useUserRole();
  const [suggestingNewOutlet, setSuggestingNewOutlet] = useState(false);

  const [omcId, setOmcId] = useState<number | "">(currentOutlet?.omcId ?? "");
  const [state, setState] = useState(currentOutlet?.state ?? "");
  const [district, setDistrict] = useState(currentOutlet?.district ?? "");

  const newOutletFields: SuggestEditField[] = useMemo(
    () => [
      { key: "id", label: "ID (slug, unique)", type: "text" },
      { key: "name", label: "Name", type: "text" },
      {
        key: "type",
        label: "Type",
        type: "select",
        options: [
          { value: "urban", label: "Urban" },
          { value: "highway", label: "Highway" },
          { value: "rural", label: "Rural" },
        ],
      },
      { key: "omc_id", label: "OMC", type: "select", options: omcs.map((o) => ({ value: String(o.id), label: o.name })) },
      { key: "state", label: "State", type: "text" },
      { key: "district", label: "District", type: "text" },
      { key: "area", label: "Area", type: "text" },
      { key: "location", label: "Location (display)", type: "text" },
      { key: "ownership", label: "Ownership", type: "text" },
      { key: "pincode", label: "Pincode", type: "text" },
      { key: "plot_sqm", label: "Plot area (sqm)", type: "number" },
      { key: "vacant_sqm", label: "Vacant area (sqm)", type: "number" },
      { key: "source_note", label: "Source note", type: "textarea" },
    ],
    [omcs]
  );

  const outletsForOmc = useMemo(
    () => (omcId === "" ? [] : outlets.filter((o) => o.omcId === omcId)),
    [outlets, omcId]
  );

  const states = useMemo(
    () => Array.from(new Set(outletsForOmc.map((o) => o.state).filter((s): s is string => !!s))).sort(),
    [outletsForOmc]
  );

  const districts = useMemo(
    () =>
      Array.from(
        new Set(
          outletsForOmc
            .filter((o) => o.state === state)
            .map((o) => o.district)
            .filter((d): d is string => !!d)
        )
      ).sort(),
    [outletsForOmc, state]
  );

  const outletsInDistrict = useMemo(
    () =>
      outletsForOmc
        .filter((o) => o.state === state && o.district === district)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [outletsForOmc, state, district]
  );

  const selectedOmcName = omcId === "" ? null : (omcs.find((o) => o.id === omcId)?.name ?? null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="w-full md:w-[260px] md:sticky md:top-0 md:h-screen shrink-0 bg-navy-deep text-white flex flex-col">
      <div className="px-5 py-5 border-b border-white/15">
        <span className="font-serif-display font-semibold text-lg leading-tight block">
          Retail Opportunity Finder
        </span>
        <span className="text-xs text-white/60">Non-fuel format recommendations</span>
      </div>

      <div className="px-5 py-5 flex flex-col gap-4">
        <DrillField label="OMC">
          <select
            className="drill-select"
            value={omcId}
            onChange={(e) => {
              setOmcId(e.target.value === "" ? "" : Number(e.target.value));
              setState("");
              setDistrict("");
            }}
          >
            <option value="">Select OMC…</option>
            {omcs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </DrillField>

        {omcId !== "" && states.length === 0 ? (
          <p className="text-xs text-white/50">No outlets recorded for {selectedOmcName} yet.</p>
        ) : (
          <>
            <DrillField label="State">
              <select
                className="drill-select"
                value={state}
                disabled={omcId === ""}
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
          </>
        )}
      </div>

      <div className="mt-auto px-5 py-4 border-t border-white/15 text-xs text-white/60 flex flex-col gap-2">
        <button onClick={() => setSuggestingNewOutlet(true)} className="text-left hover:text-white transition-colors">
          + Suggest a new outlet
        </button>
        {session ? (
          <>
            {role === "admin" && (
              <a href="/admin" className="hover:text-white transition-colors">
                Admin: manage data
              </a>
            )}
            <button onClick={handleSignOut} className="text-left hover:text-white transition-colors">
              Sign out{role === "contributor" ? " (contributor)" : ""}
            </button>
          </>
        ) : (
          <a href="/admin/login" className="hover:text-white transition-colors">
            Sign in
          </a>
        )}
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

      {suggestingNewOutlet && (
        <SuggestEditModal
          title="Suggest a new outlet"
          targetTable="ro_profiles"
          targetRecordId={null}
          currentValues={{}}
          fields={newOutletFields}
          onClose={() => setSuggestingNewOutlet(false)}
          onSubmitted={() => {}}
        />
      )}
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
