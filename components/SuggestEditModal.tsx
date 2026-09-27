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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to suggest an edit.");
      setSubmitting(false);
      return;
    }

    const proposedChanges: Record<string, unknown> =
      targetRecordId === null
        ? draft
        : Object.fromEntries(
            Object.entries(draft).filter(([key, value]) => value !== (currentValues[key] ?? (Array.isArray(value) ? [] : "")))
          );

    if (Object.keys(proposedChanges).length === 0) {
      setError("No changes to submit.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("submissions").insert({
      target_table: targetTable,
      target_record_id: targetRecordId,
      proposed_changes: proposedChanges,
      submitted_by: user.id,
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSubmitted();
    onClose();
  }

  return (
    <Modal title={title} subtitle="Changes are reviewed by an admin before they go live." onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
