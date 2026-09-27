import type { OutletType } from "./types";

export type FormatCategoryTag = "fb" | "conv" | "auto" | "other";

export interface TaxonomyFormat {
  code: string;
  theme: string;
  format: string;
  urban: boolean;
  highway: boolean;
  rural: boolean;
  categoryTag: FormatCategoryTag;
}

function categoryTagFor(code: string): FormatCategoryTag {
  if (code.startsWith("A1.")) return "fb";
  if (code.startsWith("A2.")) return "conv";
  if (code.startsWith("A3.")) return "auto";
  return "other";
}

/**
 * Category A - Customer-Facing Retail. Fixed reference data; the recommendation
 * engine (lib/scoring.ts) scores only these formats. Category B (infrastructure
 * leasing) is out of scope for this build.
 */
const RAW: [string, string, string, boolean, boolean, boolean][] = [
  ["A1.1", "Food & Beverage", "QSR", true, true, false],
  ["A1.2", "Food & Beverage", "Dhaba / Multi-cuisine Restaurant", false, true, true],
  ["A1.3", "Food & Beverage", "Cafe / Coffee Kiosk", true, true, false],
  ["A1.4", "Food & Beverage", "Bakery & Confectionery", true, true, false],
  ["A1.5", "Food & Beverage", "Ice Cream / Dessert Kiosk", true, true, false],
  ["A1.6", "Food & Beverage", "Juice / Beverage Kiosk", true, true, true],
  ["A2.1", "Convenience & General Retail", "Convenience Store", true, true, true],
  ["A2.2", "Convenience & General Retail", "Pharmacy / Wellness Store", true, true, true],
  ["A3.1", "Vehicle Care & Maintenance", "Vehicle Wash & Detailing", true, true, true],
  ["A3.2", "Vehicle Care & Maintenance", "2-Wheeler Servicing", true, true, true],
  ["A3.3", "Vehicle Care & Maintenance", "4-Wheeler Servicing", true, true, false],
  ["A3.4", "Vehicle Care & Maintenance", "Heavy Vehicle Workshop", false, true, true],
  ["A3.5", "Vehicle Care & Maintenance", "Tyre, Battery & Accessories", true, true, true],
  ["A3.6", "Vehicle Care & Maintenance", "Lubricant Bay", true, true, true],
  ["A3.7", "Vehicle Care & Maintenance", "EV Charging Point", true, true, false],
  ["A4.1", "Financial & Digital Services", "ATM / Kiosk Banking", true, true, true],
  ["A4.2", "Financial & Digital Services", "Multi-service Digital Kiosk", true, true, true],
  ["A5.1", "Logistics & Fulfillment", "Courier / E-commerce Pickup Point", true, false, false],
  ["A5.2", "Logistics & Fulfillment", "Micro-warehousing", true, true, false],
  ["A6.1", "Traveler Amenities", "Paid Restroom / Rest Area", false, true, true],
  ["A6.2", "Traveler Amenities", "Lodging & Rest Facility", false, true, true],
  ["A7.1", "Truck/Fleet Parking & Driver Facilities", "Truck & Trailer Parking", false, true, true],
  ["A7.2", "Truck/Fleet Parking & Driver Facilities", "Driver Rest & Hygiene Facility", false, true, true],
];

export const TAXONOMY: TaxonomyFormat[] = RAW.map(
  ([code, theme, format, urban, highway, rural]) => ({
    code,
    theme,
    format,
    urban,
    highway,
    rural,
    categoryTag: categoryTagFor(code),
  })
);

export const TAXONOMY_BY_CODE: Record<string, TaxonomyFormat> = Object.fromEntries(
  TAXONOMY.map((f) => [f.code, f])
);

export function isEligibleForOutletType(format: TaxonomyFormat, type: OutletType): boolean {
  if (type === "urban") return format.urban;
  if (type === "highway") return format.highway;
  return format.rural;
}
