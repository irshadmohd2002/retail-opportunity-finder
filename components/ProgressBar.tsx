interface ProgressBarProps {
  pct: number;
  color?: string;
  trackColor?: string;
  heightPx?: number;
}

export default function ProgressBar({
  pct,
  color = "var(--navy)",
  trackColor = "var(--border)",
  heightPx = 8,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="w-full rounded-sm overflow-hidden"
      style={{ height: heightPx, background: trackColor }}
    >
      <div
        className="h-full rounded-sm"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
