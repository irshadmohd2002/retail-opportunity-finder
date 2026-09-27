"use client";

import { useState } from "react";
import Modal from "./Modal";
import { supabase } from "@/lib/supabase";
import { TextField, NumberField, SelectField, CheckboxField, ArrayField, TextAreaField } from "./admin/fields";
import type { SubmissionTargetTable } from "@/lib/types";

export interface SuggestEditField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "array" | "textarea" | "select";
  options?: { value: string; label: string }[];
}

const MAX_PHOTOS = 5;

// Must mirror the bucket's allowed_mime_types in migrations/010_submission_photos_bucket.sql.
// Derived from the extension rather than the browser-reported File.type, which can be empty
// or wrong for files like clipboard-saved screenshots (e.g. "unnamed.jpg").
const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function getMimeTypeForFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (ext && EXTENSION_TO_MIME_TYPE[ext]) || null;
}

interface SuggestEditModalProps {
  title: string;
  targetTable: SubmissionTargetTable;
  /** null = proposing a brand-new record. */
  targetRecordId: string | null;
  currentValues: Record<string, unknown>;
  fields: SuggestEditField[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function SuggestEditModal({
  title,
  targetTable,
  targetRecordId,
  currentValues,
  fields,
  onClose,
  onSubmitted,
}: SuggestEditModalProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>(currentValues);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsPhotos = targetTable === "ro_profiles";

  function addPhotos(files: FileList) {
    const incoming = Array.from(files);
    const accepted = incoming.filter((file) => getMimeTypeForFilename(file.name));
    const hasInvalidType = accepted.length < incoming.length;

    if (accepted.length === 0) {
      setPhotoError("Please upload a JPG, PNG, WEBP, or GIF image.");
      return;
    }

    setPhotoFiles((existing) => {
      const combined = [...existing, ...accepted];
      if (combined.length > MAX_PHOTOS) {
        setPhotoError(`You can attach up to ${MAX_PHOTOS} photos.`);
        return combined.slice(0, MAX_PHOTOS);
      }
      setPhotoError(hasInvalidType ? "Please upload a JPG, PNG, WEBP, or GIF image." : null);
      return combined;
    });
  }

  function removePhoto(index: number) {
    setPhotoFiles((existing) => existing.filter((_, i) => i !== index));
    setPhotoError(null);
  }

  function set(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function submit() {
    setError(null);

    // Silently drop bots that auto-fill every field -- no Supabase call, no
    // error shown, since a real user never sees or fills this field.
    if (honeypot !== "") {
      onSubmitted();
      onClose();
      return;
    }

    if (!submitterName.trim() || !submitterEmail.trim()) {
      setError("Please enter your name and email.");
      return;
    }

    const proposedChanges: Record<string, unknown> =
      targetRecordId === null
        ? { ...draft }
        : Object.fromEntries(
            Object.entries(draft).filter(([key, value]) => value !== (currentValues[key] ?? (Array.isArray(value) ? [] : "")))
          );

    setSubmitting(true);

    if (supportsPhotos && photoFiles.length > 0) {
      const paths: string[] = [];
      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i];
        const path = `${targetRecordId ?? "new"}/${Date.now()}-${i}-${file.name}`;
        const contentType = getMimeTypeForFilename(file.name) ?? undefined;
        const { error: uploadError } = await supabase.storage
          .from("submission-photos")
          .upload(path, file, { contentType });
        if (uploadError) {
          setSubmitting(false);
          setError("Unable to submit right now, please try again later.");
          return;
        }
        paths.push(path);
      }
      proposedChanges.suggested_photos = paths;
    }

    if (Object.keys(proposedChanges).length === 0) {
      setSubmitting(false);
      setError("No changes to submit.");
      return;
    }

    const { error: insertError } = await supabase.from("submissions").insert({
      target_table: targetTable,
      target_record_id: targetRecordId,
      proposed_changes: proposedChanges,
      submitter_name: submitterName.trim(),
      submitter_email: submitterEmail.trim(),
    });

    setSubmitting(false);
    if (insertError) {
      setError("Unable to submit right now, please try again later.");
      return;
    }
    onSubmitted();
    onClose();
  }

  return (
    <Modal title={title} subtitle="Changes are reviewed by an admin before they go live." onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Your name" value={submitterName} onChange={setSubmitterName} />
        <TextField label="Your email" value={submitterEmail} onChange={setSubmitterEmail} />

        {/* Honeypot: hidden from real users via CSS, left visible to bots that auto-fill every field. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <label>
            Leave this field blank
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </label>
        </div>

        {fields.map((f) => {
          const value = draft[f.key];
          if (f.type === "number") {
            return (
              <NumberField
                key={f.key}
                label={f.label}
                value={(value as number | null) ?? null}
                onChange={(v) => set(f.key, v)}
              />
            );
          }
          if (f.type === "boolean") {
            return (
              <CheckboxField key={f.key} label={f.label} checked={!!value} onChange={(v) => set(f.key, v)} />
            );
          }
          if (f.type === "array") {
            return (
              <ArrayField
                key={f.key}
                label={f.label}
                value={(value as string[]) ?? []}
                onChange={(v) => set(f.key, v)}
              />
            );
          }
          if (f.type === "select") {
            return (
              <SelectField
                key={f.key}
                label={f.label}
                value={(value as string) ?? ""}
                onChange={(v) => set(f.key, v)}
                options={f.options ?? []}
              />
            );
          }
          if (f.type === "textarea") {
            return (
              <div key={f.key} className="sm:col-span-2">
                <TextAreaField label={f.label} value={(value as string) ?? ""} onChange={(v) => set(f.key, v)} />
              </div>
            );
          }
          return (
            <TextField key={f.key} label={f.label} value={(value as string) ?? ""} onChange={(v) => set(f.key, v)} />
          );
        })}
      </div>

      {supportsPhotos && (
        <div className="mt-4 pt-4 border-t border-border">
          <span className="text-sm text-muted block mb-1">Suggest photos (optional, up to {MAX_PHOTOS})</span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={photoFiles.length >= MAX_PHOTOS}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          {photoError && <p className="text-xs mt-1" style={{ color: "var(--navy)" }}>{photoError}</p>}
          {photoFiles.length > 0 && (
            <ul className="text-xs text-muted mt-2 flex flex-col gap-1">
              {photoFiles.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center gap-2">
                  <span className="truncate">{file.name}</span>
                  <button onClick={() => removePhoto(i)} className="text-navy hover:underline shrink-0">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm mt-4" style={{ color: "var(--navy)" }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-sm border border-border">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="text-sm px-3 py-1.5 rounded-sm bg-navy text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </Modal>
  );
}
