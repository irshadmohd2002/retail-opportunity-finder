interface SourcedValueProps {
  value: number | string | null;
  sourced: boolean;
  format?: (v: number | string) => string;
  unavailableLabel?: string;
  phase2Note?: string;
  className?: string;
}

/**
 * Renders a single data field with the sourced/not-sourced distinction the
 * spec requires everywhere: a sourced value is plain ink text, an unsourced
 * (estimated) value is always muted+italic, and a genuinely missing value
 * never collapses to "0" -- it says so explicitly.
 */
export default function SourcedValue({
  value,
  sourced,
  format,
  unavailableLabel = "Not yet available",
  phase2Note,
  className = "",
}: SourcedValueProps) {
  if (value === null || value === undefined) {
    return (
      <span className={`text-muted italic ${className}`}>
        {unavailableLabel}
        {phase2Note ? <span className="block text-xs not-italic mt-0.5">{phase2Note}</span> : null}
      </span>
    );
  }

  const display = format ? format(value) : String(value);

  return (
    <span className={`${sourced ? "text-ink" : "text-muted italic"} ${className}`}>
      {display}
      {!sourced && <span className="ml-1 text-xs align-top">(est.)</span>}
    </span>
  );
}
