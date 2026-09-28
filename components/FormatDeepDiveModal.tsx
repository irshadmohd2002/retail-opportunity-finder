"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import Modal from "./Modal";
import SourcedValue from "./SourcedValue";
import SuggestEditModal, { type SuggestEditField } from "./SuggestEditModal";
import { formatInrRange, formatSqft, formatPct, formatMonths } from "@/lib/format";
import { competitionDisplay } from "@/lib/formatListState";
import type { ScoredFormat } from "@/lib/scoring";

interface FormatDeepDiveModalProps {
  scored: ScoredFormat;
  onClose: () => void;
}

const PHASE2_NOTE = "Real unit-economics data is a Phase 2 item, pending outlet-level data collection.";

const FORMAT_SUGGEST_FIELDS: SuggestEditField[] = [
  { key: "space_sqft", label: "Space (sqft)", type: "number" },
  { key: "space_sourced", label: "Space sourced/verified", type: "boolean" },
  { key: "space_source_note", label: "Space source note", type: "textarea" },
  { key: "capex_min_inr", label: "Capex min (INR)", type: "number" },
  { key: "capex_max_inr", label: "Capex max (INR)", type: "number" },
  { key: "capex_sourced", label: "Capex sourced/verified", type: "boolean" },
  { key: "capex_source_note", label: "Capex source note", type: "textarea" },
  { key: "revenue_monthly_inr", label: "Typical monthly revenue (INR)", type: "number" },
  { key: "revenue_sourced", label: "Revenue sourced/verified", type: "boolean" },
  { key: "ebitda_margin_pct", label: "EBITDA margin (%)", type: "number" },
  { key: "ebitda_sourced", label: "EBITDA sourced/verified", type: "boolean" },
  { key: "payback_months", label: "Payback (months)", type: "number" },
  { key: "payback_sourced", label: "Payback sourced/verified", type: "boolean" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export default function FormatDeepDiveModal({ scored, onClose }: FormatDeepDiveModalProps) {
  const { taxonomy, economics } = scored;
  const [suggesting, setSuggesting] = useState(false);
  const competition = competitionDisplay(scored);

  return (
    <Modal title={taxonomy.format} subtitle={taxonomy.theme} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Typical space">
          <SourcedValue
            value={economics?.space_sqft ?? null}
            sourced={economics?.space_sourced ?? false}
            format={(v) => formatSqft(Number(v))}
            phase2Note={PHASE2_NOTE}
          />
          {economics?.space_source_note && (
            <p className="text-xs text-muted mt-1">{economics.space_source_note}</p>
          )}
        </Field>

        <Field label="Capex range">
          <SourcedValue
            value={
              economics?.capex_min_inr != null || economics?.capex_max_inr != null
                ? formatInrRange(economics.capex_min_inr, economics.capex_max_inr)
                : null
            }
            sourced={economics?.capex_sourced ?? false}
            phase2Note={PHASE2_NOTE}
          />
          {economics?.capex_source_note && (
            <p className="text-xs text-muted mt-1">{economics.capex_source_note}</p>
          )}
        </Field>

        <Field label="Typical monthly revenue">
          <SourcedValue
            value={economics?.revenue_monthly_inr ?? null}
            sourced={economics?.revenue_sourced ?? false}
            format={(v) => formatInrRange(Number(v), null)}
            phase2Note={PHASE2_NOTE}
          />
        </Field>

        <Field label="EBITDA margin">
          <SourcedValue
            value={economics?.ebitda_margin_pct ?? null}
            sourced={economics?.ebitda_sourced ?? false}
            format={(v) => formatPct(Number(v))}
            phase2Note={PHASE2_NOTE}
          />
        </Field>

        <Field label="Payback period">
          <SourcedValue
            value={economics?.payback_months ?? null}
            sourced={economics?.payback_sourced ?? false}
            format={(v) => formatMonths(Number(v))}
            phase2Note={PHASE2_NOTE}
          />
        </Field>
      </div>

      {economics?.notes && <p className="text-sm text-muted mt-6 border-t border-border pt-4">{economics.notes}</p>}

      {competition.competitorLine && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm text-muted">Competition nearby</p>
          <p className="text-sm mt-1">{competition.competitorLine}</p>
          <p className="text-sm mt-1">
            <span className="text-muted">Whitespace: </span>
            {competition.whitespaceLabel === "no data" ? (
              <span className="italic text-muted">no data</span>
            ) : (
              `${competition.whitespaceLabel} / 100`
            )}
          </p>
          {competition.caveat && <p className="text-xs text-muted mt-1">{competition.caveat}</p>}
          {competition.sourceNote && <p className="text-xs text-muted italic mt-1">{competition.sourceNote}</p>}
        </div>
      )}

      <button
        onClick={() => setSuggesting(true)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm border border-border text-ink hover:bg-bg transition-colors mt-6"
      >
        <Pencil size={16} /> Suggest an edit
      </button>

      {suggesting && (
        <SuggestEditModal
          title={`Suggest an edit — ${taxonomy.format}`}
          targetTable="format_economics"
          targetRecordId={economics?.code ?? null}
          currentValues={{ code: taxonomy.code, name: taxonomy.format, ...(economics ?? {}) }}
          fields={FORMAT_SUGGEST_FIELDS}
          onClose={() => setSuggesting(false)}
          onSubmitted={() => {}}
        />
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
