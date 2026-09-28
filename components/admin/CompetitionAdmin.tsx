"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RO_FORMAT_COMPETITION_SCHEMA, fetchRoFormatCompetitionDbContext } from "@/lib/csvSchemas";
import CsvImport from "./CsvImport";

export default function CompetitionAdmin() {
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { count, error } = await supabase
      .from("ro_format_competition")
      .select("ro_id", { count: "exact", head: true });
    if (error) setError(error.message);
    else {
      setError(null);
      setRowCount(count ?? 0);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch on mount
    load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Competition data</h2>
        <CsvImport
          schema={RO_FORMAT_COMPETITION_SCHEMA}
          fetchDbContext={fetchRoFormatCompetitionDbContext}
          onImported={load}
        />
      </div>
      <p className="text-sm text-muted">
        Per-outlet, per-format competitor counts and gap scores (source: Foursquare OS Places; may be stale or
        incomplete). An outlet with rows here uses these gap scores as its whitespace input; an outlet with none keeps
        using its whitespace index.
      </p>
      {error && <p className="text-sm" style={{ color: "var(--navy)" }}>{error}</p>}
      {rowCount !== null && <p className="text-sm">{rowCount.toLocaleString("en-IN")} rows currently stored.</p>}
    </div>
  );
}
