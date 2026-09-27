"use client";

import Modal from "./Modal";
import SourcedValue from "./SourcedValue";
import { formatInrRange, formatSqft, formatPct, formatMonths } from "@/lib/format";
import type { FormatEconomics } from "@/lib/types";
import type { TaxonomyFormat } from "@/lib/taxonomy";

interface FormatDeepDiveModalProps {
  taxonomy: TaxonomyFormat;
  economics: FormatEconomics | null;
  onClose: () => void;
}

const PHASE2_NOTE = "Real unit-economics data is a Phase 2 item, pending outlet-level data collection.";

export default function FormatDeepDiveModal({ taxonomy, economics, onClose }: FormatDeepDiveModalProps) {
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
