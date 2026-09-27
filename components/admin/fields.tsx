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

export const inputClassName = inputClass;
