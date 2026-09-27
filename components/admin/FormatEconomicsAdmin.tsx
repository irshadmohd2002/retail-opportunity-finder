"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FormatEconomics } from "@/lib/types";
import { TAXONOMY } from "@/lib/taxonomy";
import { FORMAT_ECONOMICS_SCHEMA, fetchFormatEconomicsDbContext } from "@/lib/csvSchemas";
import Modal from "../Modal";
import { NumberField, CheckboxField, TextAreaField } from "./fields";
import CsvImport from "./CsvImport";

function blankFor(code: string, name: string): FormatEconomics {
  return {
    code,
    name,
    space_sqft: null,
    space_sourced: false,
    space_source_note: "",
    capex_min_inr: null,
    capex_max_inr: null,
    capex_sourced: false,
    capex_source_note: "",
    revenue_monthly_inr: null,
    revenue_sourced: false,
    ebitda_margin_pct: null,
    ebitda_sourced: false,
    payback_months: null,
    payback_sourced: false,
    notes: "",
    updated_at: new Date().toISOString(),
    speed_to_launch_tier: null,
  };
}

export default function FormatEconomicsAdmin() {
  const [rows, setRows] = useState<Record<string, FormatEconomics>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<FormatEconomics | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("format_economics").select("*");
    if (error) setError(error.message);
    else setRows(Object.fromEntries((data ?? []).map((r) => [r.code, r as FormatEconomics])));
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
    const { error } = await supabase.from("format_economics").upsert(draft);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDraft(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Format economics</h2>
        <CsvImport schema={FORMAT_ECONOMICS_SCHEMA} fetchDbContext={fetchFormatEconomicsDbContext} onImported={load} />
      </div>
      {error && <p className="text-sm" style={{ color: "var(--navy)" }}>{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <table className="w-full bg-surface rounded-md shadow-card border border-border">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Format</th>
              <th className="px-3 py-2">Space (sqft)</th>
              <th className="px-3 py-2">Capex</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {TAXONOMY.map((t) => {
              const row = rows[t.code] ?? blankFor(t.code, t.format);
              return (
                <tr key={t.code} className="border-b border-border last:border-b-0 text-sm">
                  <td className="px-3 py-2 text-muted">{t.code}</td>
                  <td className="px-3 py-2">{t.format}</td>
                  <td className="px-3 py-2 text-muted">{row.space_sqft ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">
                    {row.capex_min_inr ? `₹${(row.capex_min_inr / 1e5).toFixed(1)}L+` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setDraft(row)} className="text-xs text-navy hover:underline">
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {draft && (
        <Modal title={draft.name} subtitle={draft.code} onClose={() => setDraft(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberField label="Space (sqft)" value={draft.space_sqft} onChange={(v) => setDraft({ ...draft, space_sqft: v })} />
            <CheckboxField label="Space sourced/verified" checked={draft.space_sourced} onChange={(v) => setDraft({ ...draft, space_sourced: v })} />
            <div className="sm:col-span-2">
              <TextAreaField label="Space source note" value={draft.space_source_note ?? ""} onChange={(v) => setDraft({ ...draft, space_source_note: v })} />
            </div>

            <NumberField label="Capex min (INR)" value={draft.capex_min_inr} onChange={(v) => setDraft({ ...draft, capex_min_inr: v })} />
            <NumberField label="Capex max (INR)" value={draft.capex_max_inr} onChange={(v) => setDraft({ ...draft, capex_max_inr: v })} />
            <CheckboxField label="Capex sourced/verified" checked={draft.capex_sourced} onChange={(v) => setDraft({ ...draft, capex_sourced: v })} />
            <div className="sm:col-span-2">
              <TextAreaField label="Capex source note" value={draft.capex_source_note ?? ""} onChange={(v) => setDraft({ ...draft, capex_source_note: v })} />
            </div>

            <NumberField label="Typical monthly revenue (INR)" value={draft.revenue_monthly_inr} onChange={(v) => setDraft({ ...draft, revenue_monthly_inr: v })} />
            <CheckboxField label="Revenue sourced/verified" checked={draft.revenue_sourced} onChange={(v) => setDraft({ ...draft, revenue_sourced: v })} />

            <NumberField label="EBITDA margin (%)" value={draft.ebitda_margin_pct} onChange={(v) => setDraft({ ...draft, ebitda_margin_pct: v })} />
            <CheckboxField label="EBITDA sourced/verified" checked={draft.ebitda_sourced} onChange={(v) => setDraft({ ...draft, ebitda_sourced: v })} />

            <NumberField label="Payback (months)" value={draft.payback_months} onChange={(v) => setDraft({ ...draft, payback_months: v })} />
            <CheckboxField label="Payback sourced/verified" checked={draft.payback_sourced} onChange={(v) => setDraft({ ...draft, payback_sourced: v })} />

            <NumberField
              label="Speed to launch tier (1=fast – 3=slow)"
              value={draft.speed_to_launch_tier}
              onChange={(v) => setDraft({ ...draft, speed_to_launch_tier: v })}
            />

            <div className="sm:col-span-2">
              <TextAreaField label="Notes" value={draft.notes ?? ""} onChange={(v) => setDraft({ ...draft, notes: v })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setDraft(null)} className="text-sm px-3 py-1.5 rounded-sm border border-border">
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="text-sm px-3 py-1.5 rounded-sm bg-navy text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
