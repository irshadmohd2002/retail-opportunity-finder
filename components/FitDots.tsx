interface FitDotsProps {
  score: number | null;
}

/** Stage 3 score (0-100) rendered as a 5-dot fit-strength indicator. */
export default function FitDots({ score }: FitDotsProps) {
  if (score === null) {
    return <span className="text-xs text-muted italic">Score not available</span>;
  }
  const filled = Math.max(0, Math.min(5, Math.round(score / 20)));
  return (
    <div className="flex gap-1" title={`Fit score: ${Math.round(score)}/100`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="block w-2 h-2 rounded-full"
          style={{ background: i < filled ? "var(--navy)" : "var(--border)" }}
        />
      ))}
    </div>
  );
}
