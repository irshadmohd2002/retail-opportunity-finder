import type { Metadata } from "next";
import { Fraunces, Work_Sans, Newsreader, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import type { FontPairing, SizeScale } from "@/lib/types";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Retail Opportunity Finder",
  description: "Non-fuel retail format recommendations for fuel retail outlets",
};

export interface OutletSummary {
  id: string;
  name: string;
  area: string | null;
  state: string | null;
  district: string | null;
  omcId: number | null;
  omcName: string | null;
}

interface SidebarData {
  outlets: OutletSummary[];
  omcs: { id: number; name: string }[];
}

async function getSidebarData(): Promise<SidebarData> {
  const [{ data, error }, { data: omcs }] = await Promise.all([
    supabase.from("ro_profiles").select("id, name, area, state, district, omc_id").order("state").order("district").order("name"),
    supabase.from("omcs").select("id, name").order("name"),
  ]);
  if (error) {
    console.error("Failed to load outlets for sidebar:", error.message);
    return { outlets: [], omcs: omcs ?? [] };
  }
  const omcNameById = new Map((omcs ?? []).map((o) => [o.id, o.name as string]));
  const outlets = (data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    area: o.area,
    state: o.state,
    district: o.district,
    omcId: o.omc_id,
    omcName: o.omc_id != null ? (omcNameById.get(o.omc_id) ?? null) : null,
  }));
  return { outlets, omcs: omcs ?? [] };
}

const FONT_PAIRINGS: Record<FontPairing, { heading: string; body: string }> = {
  editorial: { heading: "var(--font-fraunces)", body: "var(--font-work-sans)" },
  classic: { heading: "var(--font-newsreader)", body: "var(--font-inter)" },
  modern: { heading: "var(--font-space-grotesk)", body: "var(--font-inter)" },
};

const SIZE_SCALE_PX: Record<SizeScale, number> = {
  compact: 14,
  normal: 16,
  large: 18,
};

async function getSiteSettings() {
  const { data } = await supabase.from("site_settings").select("*").eq("id", "global").maybeSingle();
  return {
    fontPairing: (data?.font_pairing ?? "editorial") as FontPairing,
    accentColor: data?.accent_color ?? "#C0293A",
    sizeScale: (data?.size_scale ?? "normal") as SizeScale,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ outlets, omcs }, settings] = await Promise.all([getSidebarData(), getSiteSettings()]);
  const pairing = FONT_PAIRINGS[settings.fontPairing];

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${workSans.variable} ${newsreader.variable} ${inter.variable} ${spaceGrotesk.variable} h-full`}
      style={
        {
          "--font-serif-display": pairing.heading,
          "--font-sans": pairing.body,
          "--navy": settings.accentColor,
          fontSize: `${SIZE_SCALE_PX[settings.sizeScale]}px`,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col md:flex-row" suppressHydrationWarning>
        <Sidebar outlets={outlets} omcs={omcs} />
        <main className="flex-1 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
