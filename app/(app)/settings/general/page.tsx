import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GeneralView, type GeneralInitial } from "@/components/settings/views/GeneralView";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("tabGeneral") };
}
export const instant = false;

export default async function Page() {
  await connection();
  const supabase = await createClient();
  let initial: GeneralInitial | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("business_settings")
      .select("business_name,legal_name,email,phone,address,city,country,timezone,currency,public_url,logo_url,default_locale,slot_increment_min,buffer_min,min_notice_hours")
      .eq("id", true)
      .maybeSingle();
    if (data) {
      initial = {
        businessName: (data.business_name as string) ?? "",
        legalName: (data.legal_name as string | null) ?? "",
        email: (data.email as string | null) ?? "",
        phone: (data.phone as string | null) ?? "",
        address: (data.address as string | null) ?? "",
        city: (data.city as string | null) ?? "",
        country: (data.country as string | null) ?? "Morocco",
        timezone: (data.timezone as string) ?? "Africa/Casablanca",
        currency: (data.currency as string) ?? "MAD",
        publicUrl: (data.public_url as string | null) ?? "",
        logoUrl: (data.logo_url as string | null) ?? null,
        defaultLocale: data.default_locale === "fr" ? "fr" : "en",
        slotIncrementMin: (Number(data.slot_increment_min) as 15 | 30 | 60) || 30,
        bufferMin: Number(data.buffer_min ?? 0),
        minNoticeHours: Number(data.min_notice_hours ?? 2),
      };
    }
  }
  return <GeneralView initial={initial} live={initial !== null} />;
}
