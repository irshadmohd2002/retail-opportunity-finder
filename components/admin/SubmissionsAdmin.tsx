"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Submission, SubmissionTargetTable } from "@/lib/types";

const TARGET_LABEL: Record<SubmissionTargetTable, string> = {
  ro_profiles: "Outlet",
  format_economics: "Format economics",
  brand_partnerships: "Brand partnership",
};

const PRIMARY_KEY: Record<SubmissionTargetTable, string> = {
  ro_profiles: "id",
  format_economics: "code",
  brand_partnerships: "id",
};

interface EnrichedSubmission {
  submission: Submission;
  current: Record<string, unknown> | null;
}

function buildPayload(submission: Submission): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...submission.proposed_changes };
  if (submission.target_table === "ro_profiles" && typeof payload.omc_id === "string") {
    payload.omc_id = Number(payload.omc_id);
  }
  return payload;
}

export default function SubmissionsAdmin({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [rows, setRows] = useState<EnrichedSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notesById, setNotesById] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const submissions = (data ?? []) as Submission[];
    onCountChange?.(submissions.length);

    const enriched = await Promise.all(
      submissions.map(async (s) => {
        if (!s.target_record_id) return { submission: s, current: null };
        const pk = PRIMARY_KEY[s.target_table];
        const idValue = s.target_table === "brand_partnerships" ? Number(s.target_record_id) : s.target_record_id;
        const { data: current } = await supabase.from(s.target_table).select("*").eq(pk, idValue).maybeSingle();
        return { submission: s, current: current as Record<string, unknown> | null };
      })
    );
    setRows(enriched);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable for this component's lifetime
  }, []);

  async function approve(row: EnrichedSubmission) {
    const { submission } = row;
    setBusyId(submission.id);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const payload = buildPayload(submission);
    const pk = PRIMARY_KEY[submission.target_table];

    let writeError = null;
    if (submission.target_record_id) {
      const idValue =
        submission.target_table === "brand_partnerships" ? Number(submission.target_record_id) : submission.target_record_id;
      const { error } = await supabase.from(submission.target_table).update(payload).eq(pk, idValue);
      writeError = error;
    } else {
      const { error } = await supabase.from(submission.target_table).insert(payload);
      writeError = error;
    }

    if (writeError) {
      setError(writeError.message);
      setBusyId(null);
      return;
    }

    const { error: statusError } = await supabase
      .from("submissions")
      .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", submission.id);
    setBusyId(null);
    if (statusError) {
      setError(statusError.message);
      return;
    }
    load();
  }

  async function reject(row: EnrichedSubmission) {
    setBusyId(row.submission.id);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("submissions")
      .update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: notesById[row.submission.id] || null,
      })
      .eq("id", row.submission.id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold">Pending submissions {rows.length > 0 && `(${rows.length})`}</h2>
      {error && <p className="text-sm" style={{ color: "var(--navy)" }}>{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-muted italic">Nothing pending review.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => {
            const { submission, current } = row;
            const isNew = !submission.target_record_id;
            return (
              <div key={submission.id} className="bg-surface rounded-md shadow-card border border-border p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-medium">
                      {TARGET_LABEL[submission.target_table]}
                      {isNew ? " — new record" : ` — ${submission.target_record_id}`}
                    </p>
                    <p className="text-xs text-muted">
                      Submitted {new Date(submission.created_at).toLocaleString("en-IN")} by{" "}
                      {submission.submitted_by.slice(0, 8)}…
                    </p>
                  </div>
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="py-1 pr-2">Field</th>
                      <th className="py-1 pr-2">Current</th>
                      <th className="py-1">Proposed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(submission.proposed_changes).map(([key, value]) => (
                      <tr key={key} className="border-b border-border last:border-b-0">
                        <td className="py-1 pr-2 text-muted">{key}</td>
                        <td className="py-1 pr-2 text-muted">
                          {isNew ? "—" : String(current?.[key] ?? "—")}
                        </td>
                        <td className="py-1">{Array.isArray(value) ? value.join(", ") || "—" : String(value ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="Rejection note (optional)"
                    className="border border-border rounded-sm px-2 py-1 bg-surface text-xs flex-1"
                    value={notesById[submission.id] ?? ""}
                    onChange={(e) => setNotesById((n) => ({ ...n, [submission.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => reject(row)}
                    disabled={busyId === submission.id}
                    className="text-xs px-3 py-1.5 rounded-sm border border-border disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approve(row)}
                    disabled={busyId === submission.id}
                    className="text-xs px-3 py-1.5 rounded-sm bg-navy text-white disabled:opacity-50"
                  >
                    {busyId === submission.id ? "Working…" : "Approve"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
