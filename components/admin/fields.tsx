"use client";

import { useEffect, useId, useRef, useState } from "react";
import { resolveTenantsEdit, tenantsMode, type TenantsMode } from "@/lib/existingTenants";

interface FieldWrapProps {
  label: string;
  children: React.ReactNode;
}

function FieldWrap({ label, children }: FieldWrapProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "border border-border rounded-sm px-2.5 py-1.5 bg-surface text-sm";

export function TextField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <FieldWrap label={label}>
      <input
        type="text"
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldWrap>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <FieldWrap label={label}>
      <input
        type="number"
        className={inputClass}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </FieldWrap>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <FieldWrap label={label}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-muted">{label}</span>
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldWrap label={label}>
      <textarea className={inputClass} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </FieldWrap>
  );
}

export function ArrayField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <FieldWrap label={`${label} (comma-separated)`}>
      <input
        type="text"
        className={inputClass}
        placeholder={placeholder}
        value={value.join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
        }
      />
    </FieldWrap>
  );
}

const TENANT_MODES: { mode: TenantsMode; label: string }[] = [
  { mode: "unknown", label: "Unknown" },
  { mode: "none", label: "None confirmed" },
  { mode: "has", label: "Has outlets" },
];

/**
 * Three-way control for a nullable array: Unknown (null) / None confirmed ([]) /
 * Has outlets (codes). Emits only on user interaction, so merely opening a form
 * never changes the stored value.
 */
export function TenantsField({
  label,
  value,
  onChange,
  onIncompleteChange,
  placeholder,
}: {
  label: string;
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  /** Called with true while "Has outlets" is selected with no codes; the parent must block saving. */
  onIncompleteChange?: (incomplete: boolean) => void;
  placeholder?: string;
}) {
  const groupName = useId();
  const [mode, setMode] = useState<TenantsMode>(() => tenantsMode(value));
  const [codesText, setCodesText] = useState(() => (value ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  // Clear the parent's "incomplete" flag when the field goes away (e.g. the form is cancelled).
  const incompleteCallback = useRef(onIncompleteChange);
  useEffect(() => {
    incompleteCallback.current = onIncompleteChange;
  });
  useEffect(() => () => incompleteCallback.current?.(false), []);

  function update(nextMode: TenantsMode, nextText: string) {
    setMode(nextMode);
    setCodesText(nextText);
    const edit = resolveTenantsEdit(nextMode, nextText);
    setError(edit.ok ? null : edit.error);
    onIncompleteChange?.(!edit.ok);
    // An incomplete choice is not emitted, so it can never reach the draft as [] ("None confirmed").
    if (edit.ok) onChange(edit.value);
  }

  return (
    <div className="flex flex-col gap-1 text-sm sm:col-span-2">
      <span className="text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-4">
        {TENANT_MODES.map((m) => (
          <label key={m.mode} className="flex items-center gap-1.5">
            <input type="radio" name={groupName} checked={mode === m.mode} onChange={() => update(m.mode, codesText)} />
            <span>{m.label}</span>
          </label>
        ))}
      </div>
      {mode === "has" && (
        <input
          type="text"
          className={inputClass}
          placeholder={placeholder}
          aria-label={`${label} (comma-separated codes)`}
          value={codesText}
          onChange={(e) => update("has", e.target.value)}
        />
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--navy)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClassName = inputClass;
