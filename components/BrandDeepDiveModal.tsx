"use client";

import Modal from "./Modal";
import SourcedValue from "./SourcedValue";
import { formatInr, formatPct } from "@/lib/format";
import type { BrandPartnership } from "@/lib/types";

interface BrandDeepDiveModalProps {
  brand: BrandPartnership;
  onClose: () => void;
}

const VERIFY_LABEL = "Not yet available — verify directly with brand";

export default function BrandDeepDiveModal({ brand, onClose }: BrandDeepDiveModalProps) {
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
