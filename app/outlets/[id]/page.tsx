import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { RoProfile, FormatEconomics, BrandPartnership } from "@/lib/types";
import OutletSummaryCard from "@/components/OutletSummaryCard";
import FormatList from "@/components/FormatList";

interface OutletPageProps {
  params: Promise<{ id: string }>;
}

export default async function OutletPage({ params }: OutletPageProps) {
  const { id } = await params;

  const [{ data: outlet }, { data: economics }, { data: brands }] = await Promise.all([
    supabase.from("ro_profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("format_economics").select("*"),
    supabase.from("brand_partnerships").select("*"),
  ]);

  if (!outlet) notFound();

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
      <OutletSummaryCard outlet={outlet as RoProfile} />
      <FormatList
        outlet={outlet as RoProfile}
        economics={(economics ?? []) as FormatEconomics[]}
        brands={(brands ?? []) as BrandPartnership[]}
      />
    </div>
  );
}
