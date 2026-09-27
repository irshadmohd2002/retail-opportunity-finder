import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { RoProfile, FormatEconomics, BrandPartnership } from "@/lib/types";
import { haversineKm, CATCHMENT_RADIUS_KM } from "@/lib/geo";
import OutletSummaryCard from "@/components/OutletSummaryCard";
import FormatList from "@/components/FormatList";
import NearbyOutlets from "@/components/NearbyOutlets";

interface OutletPageProps {
  params: Promise<{ id: string }>;
}

const NEARBY_LIMIT = 10;

export default async function OutletPage({ params }: OutletPageProps) {
  const { id } = await params;

  const [{ data: outlet }, { data: economics }, { data: brands }, { data: allOutlets }, { data: omcs }] =
    await Promise.all([
      supabase.from("ro_profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("format_economics").select("*"),
      supabase.from("brand_partnerships").select("*"),
      supabase.from("ro_profiles").select("id, name, omc_id, latitude, longitude"),
      supabase.from("omcs").select("id, name"),
    ]);

  if (!outlet) notFound();

  const omcNameById = new Map((omcs ?? []).map((o) => [o.id, o.name as string]));
  const outletOmcName = omcNameById.get(outlet.omc_id) ?? null;

  let nearby: { id: string; name: string; omcName: string | null; distanceKm: number }[] | null = null;
  if (outlet.latitude != null && outlet.longitude != null) {
    const radiusKm = CATCHMENT_RADIUS_KM[outlet.type as RoProfile["type"]];
    nearby = (allOutlets ?? [])
      .filter((o) => o.id !== outlet.id && o.latitude != null && o.longitude != null)
      .map((o) => ({
        id: o.id as string,
        name: o.name as string,
        omcName: omcNameById.get(o.omc_id) ?? null,
        distanceKm: haversineKm(outlet.latitude!, outlet.longitude!, o.latitude!, o.longitude!),
      }))
      .filter((o) => o.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, NEARBY_LIMIT);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
      <OutletSummaryCard
        outlet={outlet as RoProfile}
        omcName={outletOmcName}
        omcs={(omcs ?? []) as { id: number; name: string }[]}
      />
      <FormatList
        outlet={outlet as RoProfile}
        economics={(economics ?? []) as FormatEconomics[]}
        brands={(brands ?? []) as BrandPartnership[]}
      />
      {nearby && (
        <NearbyOutlets
          outlets={nearby}
          radiusKm={CATCHMENT_RADIUS_KM[outlet.type as RoProfile["type"]]}
          isApproximate={outlet.type === "highway"}
        />
      )}
    </div>
  );
}
