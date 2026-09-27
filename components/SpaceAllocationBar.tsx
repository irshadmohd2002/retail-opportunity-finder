interface SpaceAllocationBarProps {
  committedSqft: number;
  availableSqft: number;
}

export default function SpaceAllocationBar({ committedSqft, availableSqft }: SpaceAllocationBarProps) {
  const total = committedSqft + availableSqft;
  const committedPct = total > 0 ? (committedSqft / total) * 100 : 0;
  const availablePct = 100 - committedPct;

  return (
    <div>
      <div className="w-full h-3 rounded-sm overflow-hidden flex" style={{ background: "var(--border)" }}>
        <div style={{ width: `${committedPct}%`, background: "var(--muted)" }} />
        <div style={{ width: `${availablePct}%`, background: "var(--feasible-tint)" }} />
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--muted)" }} />
          Committed — {Math.round(committedSqft).toLocaleString("en-IN")} sq.ft.
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "var(--feasible-tint)", border: "1px solid var(--feasible)" }}
          />
          Available — {Math.round(availableSqft).toLocaleString("en-IN")} sq.ft.
        </span>
      </div>
    </div>
  );
}
