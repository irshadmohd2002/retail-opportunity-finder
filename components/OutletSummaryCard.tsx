"use client";

import { useState } from "react";
import { Camera, LayoutTemplate, Pencil } from "lucide-react";
import type { RoProfile } from "@/lib/types";
import { SQM_TO_SQFT } from "@/lib/scoring";
import { TAXONOMY_BY_CODE } from "@/lib/taxonomy";
import { useUserRole } from "@/lib/useUserRole";
import SpaceAllocationBar from "./SpaceAllocationBar";
import PhotosModal from "./PhotosModal";
import LayoutModal from "./LayoutModal";
import SuggestEditModal, { type SuggestEditField } from "./SuggestEditModal";

const TYPE_LABEL: Record<RoProfile["type"], string> = {
  urban: "Urban Outlet",
  highway: "Highway Outlet",
  rural: "Rural Outlet",
};

const OUTLET_SUGGEST_FIELDS: SuggestEditField[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "location", label: "Location (display)", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "district", label: "District", type: "text" },
  { key: "area", label: "Area", type: "text" },
  { key: "ownership", label: "Ownership", type: "text" },
  { key: "pincode", label: "Pincode", type: "text" },
  { key: "plot_sqm", label: "Plot area (sqm)", type: "number" },
  { key: "vacant_sqm", label: "Vacant area (sqm)", type: "number" },
  { key: "existing_tenants", label: "Existing tenant format codes", type: "array" },
  { key: "fuel_volume_kl_monthly", label: "Fuel volume (KL/month)", type: "number" },
  { key: "vehicle_mix_2w_pct", label: "2-wheeler mix %", type: "number" },
  { key: "vehicle_mix_4w_pct", label: "4-wheeler mix %", type: "number" },
  { key: "vehicle_mix_cv_pct", label: "Commercial vehicle mix %", type: "number" },
  { key: "source_note", label: "Source note", type: "textarea" },
];

export default function OutletSummaryCard({ outlet, omcName }: { outlet: RoProfile; omcName: string | null }) {
  const [modal, setModal] = useState<"photos" | "layout" | "suggest" | null>(null);
  const { role } = useUserRole();

  const plotSqft = outlet.plot_sqm !== null ? outlet.plot_sqm * SQM_TO_SQFT : null;
  const vacantSqft = outlet.vacant_sqm !== null ? outlet.vacant_sqm * SQM_TO_SQFT : null;
  const committedSqft = plotSqft !== null && vacantSqft !== null ? plotSqft - vacantSqft : null;

  const tenantNames = outlet.existing_tenants.map((code) => TAXONOMY_BY_CODE[code]?.format ?? code);

  return (
    <div className="bg-surface rounded-md shadow-card border border-border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif-display font-semibold text-2xl text-navy">{outlet.name}</h1>
          <p className="text-muted text-sm mt-1">
            {outlet.location}
            {outlet.pincode ? ` – ${outlet.pincode}` : ""}
          </p>
          {!outlet.sourced && (
            <p className="text-xs text-muted italic mt-1">Profile data not yet verified against a source</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-sm"
            style={{ background: "var(--copper-soft)", color: "var(--navy-deep)" }}
          >
            {TYPE_LABEL[outlet.type]}
          </span>
          {omcName && <span className="text-xs text-muted">{omcName}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
        <Stat label="Total plot" value={plotSqft} unit="sq.ft." sourced={outlet.sourced} />
        <Stat label="Available space" value={vacantSqft} unit="sq.ft." sourced={outlet.sourced} />
        <div>
          <p className="text-sm text-muted">Existing outlets</p>
          <p className="font-serif-display font-semibold text-2xl mt-0.5">{outlet.existing_tenants.length}</p>
          {tenantNames.length > 0 && (
            <p className="text-xs text-muted mt-1">{tenantNames.join(", ")}</p>
          )}
        </div>
      </div>

      {plotSqft !== null && vacantSqft !== null && committedSqft !== null && (
        <div className="mt-6">
          <SpaceAllocationBar committedSqft={committedSqft} availableSqft={vacantSqft} />
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setModal("photos")}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm border border-border text-ink hover:bg-bg transition-colors"
        >
          <Camera size={16} /> Site photos
        </button>
        <button
          onClick={() => setModal("layout")}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm border border-border text-ink hover:bg-bg transition-colors"
        >
          <LayoutTemplate size={16} /> Site layout
        </button>
        {role === "contributor" && (
          <button
            onClick={() => setModal("suggest")}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm border border-border text-ink hover:bg-bg transition-colors"
          >
            <Pencil size={16} /> Suggest an edit
          </button>
        )}
      </div>

      {modal === "photos" && (
        <PhotosModal outletId={outlet.id} outletName={outlet.name} onClose={() => setModal(null)} />
      )}
      {modal === "layout" && (
        <LayoutModal
          outletName={outlet.name}
          layoutDiagramUrl={outlet.layout_diagram_url}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "suggest" && (
        <SuggestEditModal
          title={`Suggest an edit — ${outlet.name}`}
          targetTable="ro_profiles"
          targetRecordId={outlet.id}
          currentValues={outlet as unknown as Record<string, unknown>}
          fields={OUTLET_SUGGEST_FIELDS}
          onClose={() => setModal(null)}
          onSubmitted={() => {}}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  sourced,
}: {
  label: string;
  value: number | null;
  unit: string;
  sourced: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      {value === null ? (
        <p className="text-muted italic mt-0.5">Not available</p>
      ) : (
        <p className={`font-serif-display font-semibold text-2xl mt-0.5 ${sourced ? "text-ink" : "text-muted italic"}`}>
          {Math.round(value).toLocaleString("en-IN")}{" "}
          <span className="text-sm font-sans font-normal">{unit}</span>
        </p>
      )}
    </div>
  );
}
