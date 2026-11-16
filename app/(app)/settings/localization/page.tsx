import { connection } from "next/server";
import type { Metadata } from "next";
import { LocalizationView } from "@/components/settings/views/LocalizationView";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Localization" };
export const instant = false;

export default async function Page() {
  await connection();
  const supabase = await createClient();
  let initial: { defaultLocale: "en" | "fr"; hourCycle: "24" | "12"; dateFormat: "eu" | "us" } | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("business_settings")
      .select("default_locale,hour_cycle,date_format")
      .eq("id", true)
      .maybeSingle();
    if (data) {
      initial = {
        defaultLocale: data.default_locale === "fr" ? "fr" : "en",
        hourCycle: data.hour_cycle === "12" ? "12" : "24",
        dateFormat: data.date_format === "us" ? "us" : "eu",
      };
    }
  }
  return <LocalizationView initial={initial} live={initial !== null} />;
}
