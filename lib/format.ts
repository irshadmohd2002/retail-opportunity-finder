export function formatInr(value: number): string {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(value % 1e7 === 0 ? 0 : 1)} Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(value % 1e5 === 0 ? 0 : 1)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatInrRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "";
  if (min !== null && max !== null) return `${formatInr(min)} – ${formatInr(max)}`;
  return formatInr((min ?? max) as number);
}

export function formatSqft(value: number): string {
  return `${Math.round(value).toLocaleString("en-IN")} sq.ft.`;
}

export function formatPct(value: number): string {
  return `${value}%`;
}

export function formatMonths(value: number): string {
  return `${value} ${value === 1 ? "month" : "months"}`;
}
