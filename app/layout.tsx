import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

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
}

async function getOutletSummaries(): Promise<OutletSummary[]> {
  const { data, error } = await supabase
    .from("ro_profiles")
    .select("id, name, area, state, district")
    .order("state")
    .order("district")
    .order("name");
  if (error) {
    console.error("Failed to load outlets for sidebar:", error.message);
    return [];
  }
  return data ?? [];
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const outlets = await getOutletSummaries();

  return (
    <html lang="en" className={`${fraunces.variable} ${workSans.variable} h-full`}>
      <body className="min-h-full flex flex-col md:flex-row" suppressHydrationWarning>
        <Sidebar outlets={outlets} />
        <main className="flex-1 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
