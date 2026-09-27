"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import Modal from "./Modal";
import SourcedValue from "./SourcedValue";
import SuggestEditModal, { type SuggestEditField } from "./SuggestEditModal";
import { formatInr, formatPct } from "@/lib/format";
import type { BrandPartnership } from "@/lib/types";

interface BrandDeepDiveModalProps {
  brand: BrandPartnership;
  onClose: () => void;
}

const VERIFY_LABEL = "Not yet available — verify directly with brand";

const BRAND_SUGGEST_FIELDS: SuggestEditField[] = [
  { key: "operating_model", label: "Operating model", type: "text" },
  { key: "brand_provides", label: "Brand provides", type: "array" },
  { key: "partner_provides", label: "Partner provides", type: "array" },
  { key: "space_min_sqft", label: "Space min (sqft)", type: "number" },
  { key: "space_max_sqft", label: "Space max (sqft)", type: "number" },
  { key: "space_sourced", label: "Space sourced/verified", type: "boolean" },
  { key: "franchise_fee_inr", label: "Franchise fee (INR)", type: "number" },
  { key: "royalty_pct", label: "Royalty (%)", type: "number" },
  { key: "marketing_fee_pct", label: "Marketing fee (%)", type: "number" },
  { key: "fees_sourced", label: "Fees sourced/verified", type: "boolean" },
  { key: "regulatory_requirements", label: "Regulatory requirements", type: "array" },
  { key: "other_requirements", label: "Other requirements", type: "array" },
  { key: "source_url", label: "Source URL", type: "text" },
];

export default function BrandDeepDiveModal({ brand, onClose }: BrandDeepDiveModalProps) {
  const [suggesting, setSuggesting] = useState(false);

  const spaceRange =
    brand.space_min_sqft != null || brand.space_max_sqft != null
      ? [brand.space_min_sqft, brand.space_max_sqft].filter((v) => v != null).join(" – ") + " sq.ft."
      : null;

  return (
    <Modal title={brand.brand_name} subtitle="Brand partnership" onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Operating model">
          <SourcedValue value={brand.operating_model} sourced={!!brand.operating_model} unavailableLabel={VERIFY_LABEL} />
        </Field>

        <Field label="Space requirement">
          <SourcedValue value={spaceRange} sourced={brand.space_sourced} unavailableLabel={VERIFY_LABEL} />
        </Field>

        <Field label="Franchise fee">
          <SourcedValue
            value={brand.franchise_fee_inr}
            sourced={brand.fees_sourced}
            format={(v) => formatInr(Number(v))}
            unavailableLabel={VERIFY_LABEL}
          />
        </Field>

        <Field label="Royalty">
          <SourcedValue
            value={brand.royalty_pct}
            sourced={brand.fees_sourced}
            format={(v) => formatPct(Number(v))}
            unavailableLabel={VERIFY_LABEL}
          />
        </Field>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-sm text-muted">Regulatory requirements</p>
        {brand.regulatory_requirements.length > 0 ? (
          <ul className="list-disc list-inside text-sm mt-1">
            {brand.regulatory_requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted italic mt-1">{VERIFY_LABEL}</p>
        )}
      </div>

      {brand.source_url && (
        <a
          href={brand.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-navy mt-4 inline-block hover:underline"
        >
          Source
        </a>
      )}

      <button
        onClick={() => setSuggesting(true)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm border border-border text-ink hover:bg-bg transition-colors mt-4"
      >
        <Pencil size={16} /> Suggest an edit
      </button>

      {suggesting && (
        <SuggestEditModal
          title={`Suggest an edit — ${brand.brand_name}`}
          targetTable="brand_partnerships"
          targetRecordId={String(brand.id)}
          currentValues={brand as unknown as Record<string, unknown>}
          fields={BRAND_SUGGEST_FIELDS}
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
