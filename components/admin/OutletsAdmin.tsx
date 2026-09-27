"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RoProfile, OutletType } from "@/lib/types";
import Modal from "../Modal";
import { TextField, NumberField, SelectField, CheckboxField, TextAreaField, ArrayField } from "./fields";

type DraftOutlet = Omit<RoProfile, "created_at" | "updated_at">;

const BLANK: DraftOutlet = {
  id: "",
  name: "",
  state: "",
  district: "",
  area: "",
  location: "",
  type: "highway",
  ownership: "",
  plot_sqm: null,
  vacant_sqm: null,
  existing_tenants: [],
  fuel_volume_kl_monthly: null,
  vehicle_mix_2w_pct: null,
  vehicle_mix_4w_pct: null,
  vehicle_mix_cv_pct: null,
  layout_diagram_url: "",
  sourced: false,
  source_note: "",
  last_verified: null,
  demand_index: null,
  whitespace_index: null,
};

export default function OutletsAdmin() {
  const [outlets, setOutlets] = useState<RoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftOutlet | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("ro_profiles").select("*").order("name");
    if (error) setError(error.message);
    else setOutlets(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch on mount
    load();
  }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("ro_profiles").upsert(draft);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDraft(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm(`Delete outlet "${id}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("ro_profiles").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Outlets</h2>
        <button
          onClick={() => {
            setDraft(BLANK);
            setIsNew(true);
          }}
          className="text-sm px-3 py-1.5 rounded-sm bg-navy text-white hover:opacity-90"
        >
          + Add outlet
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: "var(--navy)" }}>{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <table className="w-full bg-surface rounded-md shadow-card border border-border">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">State / District</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => (
              <tr key={o.id} className="border-b border-border last:border-b-0 text-sm">
                <td className="px-3 py-2 text-muted">{o.id}</td>
                <td className="px-3 py-2">{o.name}</td>
                <td className="px-3 py-2 capitalize">{o.type}</td>
                <td className="px-3 py-2 text-muted">
                  {o.state} / {o.district}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => {
                      setDraft(o);
                      setIsNew(false);
                    }}
                    className="text-xs text-navy hover:underline mr-3"
                  >
                    Edit
                  </button>
                  <button onClick={() => remove(o.id)} className="text-xs text-muted hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {draft && (
        <Modal title={isNew ? "Add outlet" : `Edit ${draft.name || draft.id}`} onClose={() => setDraft(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="ID (slug, unique)" value={draft.id} disabled={!isNew} onChange={(v) => setDraft({ ...draft, id: v })} />
            <TextField label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
            <TextField label="State" value={draft.state ?? ""} onChange={(v) => setDraft({ ...draft, state: v })} />
            <TextField label="District" value={draft.district ?? ""} onChange={(v) => setDraft({ ...draft, district: v })} />
            <TextField label="Area" value={draft.area ?? ""} onChange={(v) => setDraft({ ...draft, area: v })} />
            <TextField label="Location (display)" value={draft.location ?? ""} onChange={(v) => setDraft({ ...draft, location: v })} />
            <SelectField
              label="Type"
              value={draft.type}
              onChange={(v) => setDraft({ ...draft, type: v as OutletType })}
              options={[
                { value: "urban", label: "Urban" },
                { value: "highway", label: "Highway" },
                { value: "rural", label: "Rural" },
              ]}
            />
            <TextField label="Ownership" value={draft.ownership ?? ""} onChange={(v) => setDraft({ ...draft, ownership: v })} />
            <NumberField label="Plot area (sqm)" value={draft.plot_sqm} onChange={(v) => setDraft({ ...draft, plot_sqm: v })} />
            <NumberField label="Vacant area (sqm)" value={draft.vacant_sqm} onChange={(v) => setDraft({ ...draft, vacant_sqm: v })} />
            <ArrayField
              label="Existing tenant format codes"
              value={draft.existing_tenants}
              placeholder="A3.3, A4.1"
              onChange={(v) => setDraft({ ...draft, existing_tenants: v })}
            />
            <TextField label="Layout diagram URL" value={draft.layout_diagram_url ?? ""} onChange={(v) => setDraft({ ...draft, layout_diagram_url: v })} />
            <NumberField label="Fuel volume (KL/month)" value={draft.fuel_volume_kl_monthly} onChange={(v) => setDraft({ ...draft, fuel_volume_kl_monthly: v })} />
            <NumberField label="2-wheeler mix %" value={draft.vehicle_mix_2w_pct} onChange={(v) => setDraft({ ...draft, vehicle_mix_2w_pct: v })} />
            <NumberField label="4-wheeler mix %" value={draft.vehicle_mix_4w_pct} onChange={(v) => setDraft({ ...draft, vehicle_mix_4w_pct: v })} />
            <NumberField label="Commercial vehicle mix %" value={draft.vehicle_mix_cv_pct} onChange={(v) => setDraft({ ...draft, vehicle_mix_cv_pct: v })} />
            <NumberField
              label="Demand index (0-100, placeholder engine input)"
              value={draft.demand_index}
              onChange={(v) => setDraft({ ...draft, demand_index: v })}
            />
            <NumberField
              label="Whitespace index (0-100, placeholder engine input)"
              value={draft.whitespace_index}
              onChange={(v) => setDraft({ ...draft, whitespace_index: v })}
            />
            <CheckboxField label="Profile is sourced/verified" checked={draft.sourced} onChange={(v) => setDraft({ ...draft, sourced: v })} />
            <div className="sm:col-span-2">
              <TextAreaField label="Source note" value={draft.source_note ?? ""} onChange={(v) => setDraft({ ...draft, source_note: v })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setDraft(null)} className="text-sm px-3 py-1.5 rounded-sm border border-border">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !draft.id || !draft.name}
              className="text-sm px-3 py-1.5 rounded-sm bg-navy text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
