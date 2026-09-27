export default function Home() {
  return (
    <div className="h-full min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif-display font-semibold text-2xl text-navy">Retail Opportunity Finder</h1>
        <p className="text-muted mt-3">
          Select a state, district, and outlet from the sidebar to see recommended non-fuel retail formats
          for that outlet.
        </p>
        <p className="text-xs text-muted italic mt-6">
          Currently showing sample/illustrative data (5 outlets) — not verified, for development only.
        </p>
      </div>
    </div>
  );
}
