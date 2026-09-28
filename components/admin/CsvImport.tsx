"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "../Modal";
import {
  parseCsvFile,
  buildTemplateCsv,
  validateImport,
  buildImportPayload,
  countUnchangedBlankCells,
  recheckUpdateRows,
  groupByKeySet,
  chunk,
  type CsvTableSchema,
  type CsvDbContext,
  type ImportPreview,
  type RowResolution,
} from "@/lib/csvImport";

interface CsvImportProps {
  schema: CsvTableSchema;
  fetchDbContext: () => Promise<CsvDbContext>;
  onImported: () => void;
}

const UPSERT_BATCH_SIZE = 500;
const MAX_LISTED_ERROR_ROWS = 200;

export default function CsvImport({ schema, fetchDbContext, onImported }: CsvImportProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dbContext, setDbContext] = useState<CsvDbContext | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);
  const [recheckFailures, setRecheckFailures] = useState<{ rowNumber: number; errors: string[] }[]>([]);

  function downloadTemplate() {
    const csv = buildTemplateCsv(schema);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema.table}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setSummary(null);
    setRecheckFailures([]);
    try {
      const { rows } = await parseCsvFile(file);
      const ctx = await fetchDbContext();
      setDbContext(ctx);
      setPreview(validateImport(schema, rows, ctx));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse CSV");
    } finally {
      setLoading(false);
    }
  }

  function setResolution(rowNumber: number, resolution: RowResolution) {
    setPreview((p) =>
      p ? { ...p, rows: p.rows.map((r) => (r.rowNumber === rowNumber ? { ...r, resolution } : r)) } : p
    );
  }

  async function confirmImport() {
    if (!preview) return;
    setConfirming(true);
    setError(null);

    // A row redirected to another existing record is merged with that record's stored values, so
    // its cross-field rules are re-checked against them; failures are skipped and reported.
    const failures = dbContext ? recheckUpdateRows(schema, preview.rows, dbContext) : [];
    const failedRowNumbers = new Set(failures.map((f) => f.rowNumber));
    setRecheckFailures(failures);

    const hardErrorCount = preview.rows.filter((r) => r.errors.length > 0).length + failures.length;
    let skippedByChoice = 0;
    const items: { payload: Record<string, unknown>; kind: "insert" | "update" }[] = [];

    for (const row of preview.rows) {
      if (row.errors.length > 0 || row.parsed === null || failedRowNumbers.has(row.rowNumber)) continue;
      if (row.resolution.type === "skip") {
        skippedByChoice++;
        continue;
      }
      items.push({
        payload: buildImportPayload(schema, row.parsed, row.resolution, row.blankColumns),
        kind: row.resolution.type,
      });
    }

    // Batched so a large file (thousands of rows) never becomes one giant request. Upserts are
    // idempotent, so after a mid-way failure re-uploading the same file is safe.
    let inserted = 0;
    let updated = 0;
    let written = 0;
    // Grouped by key set first: rows that omit a key must not share a bulk request with rows that
    // include it, or the omitted column would be written as null.
    const batches = groupByKeySet(items, (i) => i.payload).flatMap((group) => chunk(group, UPSERT_BATCH_SIZE));
    for (const batch of batches) {
      setProgress({ done: written, total: items.length });
      const { error: upsertError } = await supabase
        .from(schema.table)
        .upsert(
          batch.map((b) => b.payload),
          { onConflict: schema.onConflict }
        );
      if (upsertError) {
        setError(
          written > 0
            ? `${upsertError.message} — ${written} of ${items.length} rows were written before this failed. Re-uploading the same file is safe.`
            : upsertError.message
        );
        setConfirming(false);
        setProgress(null);
        if (written > 0) onImported();
        return;
      }
      written += batch.length;
      for (const b of batch) {
        if (b.kind === "update") updated++;
        else inserted++;
      }
    }

    setConfirming(false);
    setProgress(null);
    setSummary({ inserted, updated, skipped: hardErrorCount + skippedByChoice });
    setPreview(null);
    onImported();
  }

  const hardErrorRows = preview?.rows.filter((r) => r.errors.length > 0) ?? [];
  const possibleDuplicateRows = preview?.rows.filter((r) => r.errors.length === 0 && r.duplicates.length > 0) ?? [];
  const cleanCount = preview?.rows.filter((r) => r.errors.length === 0).length ?? 0;
  const canConfirm = cleanCount > 0;
  const insertCount = preview?.rows.filter((r) => r.errors.length === 0 && r.action === "insert").length ?? 0;
  const updateCount = preview?.rows.filter((r) => r.errors.length === 0 && r.action === "update").length ?? 0;
  const unchangedBlankCells = preview ? countUnchangedBlankCells(schema, preview.rows) : 0;
  const hasNullableArray = schema.columns.some((c) => c.nullableArray);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button onClick={downloadTemplate} className="text-xs text-navy hover:underline">
          Download template
        </button>
        <label className="text-xs text-navy hover:underline cursor-pointer">
          Import CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
        {loading && <span className="text-xs text-muted">Parsing…</span>}
      </div>
      <p className="text-xs text-muted max-w-md">
        {schema.replaceOnUpdate
          ? "This import replaces rows entirely; blank means not available."
          : "Blank cells are ignored when updating an existing row, so its stored values are kept. A CSV cannot clear a value; edit the record in the admin form to do that."}
        {hasNullableArray &&
          ' For existing tenants, enter "unknown" to mark them unknown or "none" to record confirmed none; a blank cell leaves an existing row unchanged (a new row is unknown).'}
      </p>

      {error && <p className="text-xs" style={{ color: "var(--navy)" }}>{error}</p>}
      {summary && (
        <p className="text-xs text-muted">
          Import complete — {summary.inserted} inserted, {summary.updated} updated, {summary.skipped} skipped.
        </p>
      )}
      {recheckFailures.length > 0 && (
        <ul className="text-xs text-muted list-disc list-inside">
          {recheckFailures.map((f) => (
            <li key={f.rowNumber}>
              Row {f.rowNumber} skipped after redirect to an existing record: {f.errors.join("; ")}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <Modal title={`Import preview — ${schema.table}`} onClose={() => setPreview(null)}>
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted">
              {preview.rows.length} rows parsed. {hardErrorRows.length} hard error
              {hardErrorRows.length === 1 ? "" : "s"} (blocked), {possibleDuplicateRows.length} possible duplicate
              {possibleDuplicateRows.length === 1 ? "" : "s"} (your call), {cleanCount - possibleDuplicateRows.length}{" "}
              clean row{cleanCount - possibleDuplicateRows.length === 1 ? "" : "s"}.
            </p>

            <p className="text-sm">
              <span className="font-medium">{insertCount}</span> to insert,{" "}
              <span className="font-medium">{updateCount}</span> to update,{" "}
              <span className="font-medium">{hardErrorRows.length}</span> with errors (skipped).
            </p>

            {!schema.replaceOnUpdate && (
              <p className="text-xs text-muted italic">
                {unchangedBlankCells} blank or missing cell{unchangedBlankCells === 1 ? "" : "s"} on update rows will be
                left unchanged (the stored values are kept).
              </p>
            )}

            {preview.whitespaceFixCount > 0 && (
              <p className="text-xs text-muted italic">
                Automatic fix: trimmed/collapsed whitespace on {preview.whitespaceFixCount} cell
                {preview.whitespaceFixCount === 1 ? "" : "s"}. No other values were changed.
              </p>
            )}

            {hardErrorRows.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--navy)" }}>
                  Hard errors — these rows will not be imported
                </h3>
                <div className="flex flex-col gap-2">
                  {hardErrorRows.slice(0, MAX_LISTED_ERROR_ROWS).map((row) => (
                    <div key={row.rowNumber} className="text-xs border border-border rounded-sm p-2">
                      <p className="font-medium">Row {row.rowNumber}</p>
                      <ul className="list-disc list-inside text-muted mt-0.5">
                        {row.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {hardErrorRows.length > MAX_LISTED_ERROR_ROWS && (
                    <p className="text-xs text-muted italic">
                      …and {hardErrorRows.length - MAX_LISTED_ERROR_ROWS} more rows with errors not listed here.
                    </p>
                  )}
                </div>
              </section>
            )}

            {possibleDuplicateRows.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Possible duplicates — review</h3>
                <div className="flex flex-col gap-3">
                  {possibleDuplicateRows.map((row) => (
                    <div key={row.rowNumber} className="text-xs border border-border rounded-sm p-2 flex flex-col gap-2">
                      <p className="font-medium">
                        Row {row.rowNumber} — {String(row.parsed?.[schema.fuzzyField ?? ""] ?? "")}
                      </p>
                      {row.duplicates.map((d, i) => (
                        <p key={i} className="text-muted">
                          {d.kind === "within_csv"
                            ? `Near-matches row ${d.matchedRowNumber} in this file`
                            : `Near-matches existing record`}
                          : &quot;{String(row.parsed?.[schema.fuzzyField ?? ""])}&quot; vs &quot;{d.matchedLabel}&quot; (
                          {d.similarityPct}% similar{d.reason ? `; ${d.reason}` : ""})
                        </p>
                      ))}
                      <select
                        className="border border-border rounded-sm px-2 py-1 bg-surface text-xs w-fit"
                        value={
                          row.resolution.type === "update"
                            ? `update:${row.resolution.naturalKey}`
                            : row.resolution.type
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "insert") setResolution(row.rowNumber, { type: "insert" });
                          else if (v === "skip") setResolution(row.rowNumber, { type: "skip" });
                          else setResolution(row.rowNumber, { type: "update", naturalKey: v.replace("update:", "") });
                        }}
                      >
                        <option value="insert">Insert anyway (as new record)</option>
                        {row.duplicates
                          .filter((d) => d.kind === "against_db" && d.matchedNaturalKey)
                          .map((d) => (
                            <option key={d.matchedNaturalKey} value={`update:${d.matchedNaturalKey}`}>
                              Treat as update to: {d.matchedLabel}
                            </option>
                          ))}
                        <option value="skip">Skip this row</option>
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {preview.stateDistrictFlags.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2">State / district near-matches</h3>
                <p className="text-xs text-muted mb-2">
                  These feed the sidebar filters directly — a near-duplicate here splits one real place into two
                  dropdown entries. Not blocking; fix the CSV and re-upload if these should be the same value.
                </p>
                <ul className="text-xs flex flex-col gap-1">
                  {preview.stateDistrictFlags.map((f, i) => (
                    <li key={i} className="text-muted">
                      {f.field}: &quot;{f.valueA}&quot; vs &quot;{f.valueB}&quot; ({f.similarityPct}% similar)
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setPreview(null)} className="text-sm px-3 py-1.5 rounded-sm border border-border">
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={!canConfirm || confirming}
                className="text-sm px-3 py-1.5 rounded-sm bg-navy text-white disabled:opacity-50"
              >
                {confirming
                  ? progress
                    ? `Importing… ${progress.done} / ${progress.total}`
                    : "Importing…"
                  :`Confirm import (${cleanCount} row${cleanCount === 1 ? "" : "s"})`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
