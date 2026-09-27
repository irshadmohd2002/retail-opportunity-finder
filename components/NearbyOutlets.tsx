interface NearbyOutlet {
  id: string;
  name: string;
  omcName: string | null;
  distanceKm: number;
}

interface NearbyOutletsProps {
  outlets: NearbyOutlet[];
  radiusKm: number;
  isApproximate: boolean;
}

export default function NearbyOutlets({ outlets, radiusKm, isApproximate }: NearbyOutletsProps) {
  return (
    <div className="bg-surface rounded-md shadow-card border border-border p-6">
      <h2 className="font-serif-display font-semibold text-lg">Nearby outlets</h2>
      <p className="text-xs text-muted mt-1">
        Within {radiusKm} km (straight-line){isApproximate ? " — approximate; see note below" : ""}, any OMC.
      </p>

      {outlets.length === 0 ? (
        <p className="text-sm text-muted italic mt-4">No other outlets found within this catchment.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {outlets.map((o) => (
            <li key={o.id} className="py-2.5 flex items-center justify-between text-sm">
              <a href={`/outlets/${o.id}`} className="hover:underline">
                {o.name}
              </a>
              <span className="text-xs text-muted">
                {o.omcName ?? "Unknown OMC"} · {o.distanceKm.toFixed(1)} km
              </span>
            </li>
          ))}
        </ul>
      )}

      {isApproximate && (
        <p className="text-xs text-muted italic mt-4">
          Highway catchments use a straight-line radius as an approximation -- we don&apos;t yet have real highway
          corridor/route data. This should be replaced with a narrow buffer along the actual highway centerline
          once that data source exists.
        </p>
      )}
    </div>
  );
}
