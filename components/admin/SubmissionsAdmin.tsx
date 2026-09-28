"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Submission, SubmissionTargetTable } from "@/lib/types";
import { existingTenantsLabel } from "@/lib/existingTenants";

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

interface PhotoPreview {
  path: string;
  url: string | null;
}

interface EnrichedSubmission {
  submission: Submission;
  current: Record<string, unknown> | null;
  photoPreviews: PhotoPreview[];
}

// existing_tenants is tri-state (null unknown / [] confirmed none), so it is labelled rather than shown as "—".
function isTenants(submission: Submission, key: string): boolean {
  return submission.target_table === "ro_profiles" && key === "existing_tenants";
}

function suggestedPhotosOf(submission: Submission): string[] {
  return Array.isArray(submission.proposed_changes.suggested_photos)
    ? (submission.proposed_changes.suggested_photos as string[])
    : [];
}

// suggested_photos isn't a column on any target table -- it's routed to
// submission-photos/ro_images separately in approve() -- and it's rendered
// as thumbnails rather than in the plain-text diff table, so it's stripped
// out of both.
function buildPayload(submission: Submission): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...submission.proposed_changes };
  delete payload.suggested_photos;
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
        let current: Record<string, unknown> | null = null;
        if (s.target_record_id) {
          const pk = PRIMARY_KEY[s.target_table];
          const idValue = s.target_table === "brand_partnerships" ? Number(s.target_record_id) : s.target_record_id;
          const { data } = await supabase.from(s.target_table).select("*").eq(pk, idValue).maybeSingle();
          current = data as Record<string, unknown> | null;
        }

        const paths = suggestedPhotosOf(s);
        let photoPreviews: PhotoPreview[] = [];
        if (paths.length > 0) {
          const { data: signed } = await supabase.storage.from("submission-photos").createSignedUrls(paths, 3600);
          photoPreviews = paths.map((path, i) => ({ path, url: signed?.[i]?.signedUrl ?? null }));
        }

        return { submission: s, current, photoPreviews };
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

    const suggestedPhotos = suggestedPhotosOf(submission);
    if (submission.target_table === "ro_profiles" && suggestedPhotos.length > 0) {
      const outletId = submission.target_record_id ?? String(payload.id);
      const { count } = await supabase
        .from("ro_images")
        .select("id", { count: "exact", head: true })
        .eq("ro_id", outletId);
      let nextSortOrder = count ?? 0;

      for (const path of suggestedPhotos) {
        const basename = path.split("/").pop() ?? path;
        const destPath = `${outletId}/${Date.now()}-${nextSortOrder}-${basename}`;
        const { error: copyError } = await supabase.storage
          .from("submission-photos")
          .copy(path, destPath, { destinationBucket: "ro-images" });
        if (copyError) {
          setError(`Failed to copy suggested photo: ${copyError.message}`);
          setBusyId(null);
          return;
        }
        const { data: publicUrl } = supabase.storage.from("ro-images").getPublicUrl(destPath);
        const { error: imageError } = await supabase
          .from("ro_images")
          .insert({ ro_id: outletId, url: publicUrl.publicUrl, caption: null, sort_order: nextSortOrder });
        if (imageError) {
          setError(imageError.message);
          setBusyId(null);
          return;
        }
        nextSortOrder += 1;
      }
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
            const { submission, current, photoPreviews } = row;
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
                      {submission.submitter_name || "—"}
                      {submission.submitter_email ? ` (${submission.submitter_email})` : ""}
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
                    {Object.entries(submission.proposed_changes)
                      .filter(([key]) => key !== "suggested_photos")
                      .map(([key, value]) => (
                        <tr key={key} className="border-b border-border last:border-b-0">
                          <td className="py-1 pr-2 text-muted">{key}</td>
                          <td className="py-1 pr-2 text-muted">
                            {isNew
                              ? "—"
                              : isTenants(submission, key)
                                ? existingTenantsLabel(current?.[key])
                                : String(current?.[key] ?? "—")}
                          </td>
                          <td className="py-1">
                            {isTenants(submission, key)
                              ? existingTenantsLabel(value)
                              : Array.isArray(value)
                                ? value.join(", ") || "—"
                                : String(value ?? "—")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {photoPreviews.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted mb-1">Suggested photos</p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {photoPreviews.map((p) => (
                        <div key={p.path} className="rounded-sm overflow-hidden border border-border">
                          {p.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.url} alt="Suggested photo" className="w-full h-20 object-cover" />
                          ) : (
                            <div className="w-full h-20 flex items-center justify-center text-xs text-muted">
                              Unavailable
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
