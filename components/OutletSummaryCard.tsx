"use client";

import { useState } from "react";
import { Camera, LayoutTemplate } from "lucide-react";
import type { RoProfile } from "@/lib/types";
import { SQM_TO_SQFT } from "@/lib/scoring";
import { TAXONOMY_BY_CODE } from "@/lib/taxonomy";
import SpaceAllocationBar from "./SpaceAllocationBar";
import PhotosModal from "./PhotosModal";
import LayoutModal from "./LayoutModal";

const TYPE_LABEL: Record<RoProfile["type"], string> = {
  urban: "Urban Outlet",
  highway: "Highway Outlet",
  rural: "Rural Outlet",
};

export default function OutletSummaryCard({ outlet }: { outlet: RoProfile }) {
  const [modal, setModal] = useState<"photos" | "layout" | null>(null);

  const plotSqft = outlet.plot_sqm !== null ? outlet.plot_sqm * SQM_TO_SQFT : null;
  const vacantSqft = outlet.vacant_sqm !== null ? outlet.vacant_sqm * SQM_TO_SQFT : null;
  const committedSqft = plotSqft !== null && vacantSqft !== null ? plotSqft - vacantSqft : null;

  const tenantNames = outlet.existing_tenants.map((code) => TAXONOMY_BY_CODE[code]?.format ?? code);

  return (
    <div className="bg-surface rounded-md shadow-card border border-border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif-display font-semibold text-2xl text-navy">{outlet.name}</h1>
          <p className="text-muted text-sm mt-1">{outlet.location}</p>
          {!outlet.sourced && (
            <p className="text-xs text-muted italic mt-1">Profile data not yet verified against a source</p>
          )}
        </div>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-sm shrink-0"
          style={{ background: "var(--copper-soft)", color: "var(--navy-deep)" }}
        >
          {TYPE_LABEL[outlet.type]}
        </span>
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
