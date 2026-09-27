interface BrandChipProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
}

export default function BrandChip({ label, onClick }: BrandChipProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className="text-xs px-2 py-1 rounded-sm border transition-opacity hover:opacity-80"
      style={{ background: "var(--chip-bg)", borderColor: "var(--chip-border)", color: "var(--navy-deep)" }}
    >
      {label}
    </button>
  );
}
