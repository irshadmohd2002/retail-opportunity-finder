"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BrandPartnership } from "@/lib/types";
import { TAXONOMY } from "@/lib/taxonomy";
import { BRAND_PARTNERSHIPS_SCHEMA, fetchBrandPartnershipsDbContext } from "@/lib/csvSchemas";
import Modal from "../Modal";
import { TextField, NumberField, SelectField, CheckboxField, ArrayField } from "./fields";
import CsvImport from "./CsvImport";

type Draft = Omit<BrandPartnership, "id" | "created_at" | "last_verified"> & { id: number | null };

const BLANK: Draft = {
  id: null,
  brand_name: "",
  format_code: TAXONOMY[0].code,
  operating_model: "",
  brand_provides: [],
  partner_provides: [],
  space_min_sqft: null,
  space_max_sqft: null,
  space_sourced: false,
  franchise_fee_inr: null,
  royalty_pct: null,
  marketing_fee_pct: null,
  fees_sourced: false,
  regulatory_requirements: [],
  other_requirements: [],
  source_url: "",
  sourced: false,
};

export default function BrandPartnershipsAdmin() {
  const [brands, setBrands] = useState<BrandPartnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("brand_partnerships").select("*").order("format_code");
    if (error) setError(error.message);
    else setBrands(data ?? []);
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
    const { id, ...withoutId } = draft;
    const payload = id === null ? withoutId : draft;
    const { error } = await supabase.from("brand_partnerships").upsert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDraft(null);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this brand partnership? This cannot be undone.")) return;
    const { error } = await supabase.from("brand_partnerships").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Brand partnerships</h2>
        <div className="flex items-center gap-4">
          <CsvImport
            schema={BRAND_PARTNERSHIPS_SCHEMA}
            fetchDbContext={fetchBrandPartnershipsDbContext}
            onImported={load}
          />
          <button
            onClick={() => setDraft(BLANK)}
            className="text-sm px-3 py-1.5 rounded-sm bg-navy text-white hover:opacity-90"
          >
            + Add brand
          </button>
        </div>
      </div>
      {error && <p className="text-sm" style={{ color: "var(--navy)" }}>{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <table className="w-full bg-surface rounded-md shadow-card border border-border">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Format</th>
              <th className="px-3 py-2">Sourced</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-b-0 text-sm">
                <td className="px-3 py-2">{b.brand_name}</td>
                <td className="px-3 py-2 text-muted">{b.format_code}</td>
                <td className="px-3 py-2 text-muted">{b.sourced ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setDraft(b)} className="text-xs text-navy hover:underline mr-3">
                    Edit
                  </button>
                  <button onClick={() => remove(b.id)} className="text-xs text-muted hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {draft && (
        <Modal title={draft.id === null ? "Add brand" : draft.brand_name} onClose={() => setDraft(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Brand name" value={draft.brand_name} onChange={(v) => setDraft({ ...draft, brand_name: v })} />
            <SelectField
              label="Format"
              value={draft.format_code}
              onChange={(v) => setDraft({ ...draft, format_code: v })}
              options={TAXONOMY.map((t) => ({ value: t.code, label: `${t.code} — ${t.format}` }))}
            />
            <SelectField
              label="Operating model"
              value={draft.operating_model ?? ""}
              onChange={(v) => setDraft({ ...draft, operating_model: v || null })}
              options={[
                { value: "", label: "Not yet available" },
                { value: "FOFO", label: "FOFO" },
                { value: "FOCO", label: "FOCO" },
                { value: "COCO", label: "COCO" },
              ]}
            />
            <TextField label="Source URL" value={draft.source_url ?? ""} onChange={(v) => setDraft({ ...draft, source_url: v })} />

            <NumberField label="Space min (sqft)" value={draft.space_min_sqft} onChange={(v) => setDraft({ ...draft, space_min_sqft: v })} />
            <NumberField label="Space max (sqft)" value={draft.space_max_sqft} onChange={(v) => setDraft({ ...draft, space_max_sqft: v })} />
            <CheckboxField label="Space sourced/verified" checked={draft.space_sourced} onChange={(v) => setDraft({ ...draft, space_sourced: v })} />

            <NumberField label="Franchise fee (INR)" value={draft.franchise_fee_inr} onChange={(v) => setDraft({ ...draft, franchise_fee_inr: v })} />
            <NumberField label="Royalty (%)" value={draft.royalty_pct} onChange={(v) => setDraft({ ...draft, royalty_pct: v })} />
            <NumberField label="Marketing fee (%)" value={draft.marketing_fee_pct} onChange={(v) => setDraft({ ...draft, marketing_fee_pct: v })} />
            <CheckboxField label="Fees sourced/verified" checked={draft.fees_sourced} onChange={(v) => setDraft({ ...draft, fees_sourced: v })} />

            <ArrayField label="Brand provides" value={draft.brand_provides} onChange={(v) => setDraft({ ...draft, brand_provides: v })} />
            <ArrayField label="Partner provides" value={draft.partner_provides} onChange={(v) => setDraft({ ...draft, partner_provides: v })} />
            <ArrayField
              label="Regulatory requirements"
              value={draft.regulatory_requirements}
              placeholder="FSSAI"
              onChange={(v) => setDraft({ ...draft, regulatory_requirements: v })}
            />
            <ArrayField label="Other requirements" value={draft.other_requirements} onChange={(v) => setDraft({ ...draft, other_requirements: v })} />

            <CheckboxField label="Overall record sourced/verified" checked={draft.sourced} onChange={(v) => setDraft({ ...draft, sourced: v })} />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setDraft(null)} className="text-sm px-3 py-1.5 rounded-sm border border-border">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !draft.brand_name}
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
