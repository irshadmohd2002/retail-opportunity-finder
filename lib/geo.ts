import type { OutletType } from "./types";

const EARTH_RADIUS_KM = 6371;

/** Straight-line (great-circle) distance between two points, in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Catchment radius per outlet type, in km. Urban/rural are real straight-line
 * catchments. Highway is an explicitly-flagged approximation: we don't have
 * real highway corridor/route data yet, so it falls back to a 10km straight-
 * line radius. Replace with a narrow buffer along the actual highway
 * centerline once that data source exists -- a straight-line radius on a
 * highway outlet can easily include outlets on a different, unrelated road.
 */
export const CATCHMENT_RADIUS_KM: Record<OutletType, number> = {
  urban: 2,
  rural: 5,
  highway: 10,
};
