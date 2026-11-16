import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotificationsView } from "@/components/settings/views/NotificationsView";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("tabNotifications") };
}
export const instant = false;

export default async function Page() {
  await connection();
  const supabase = await createClient();
  let initialPrefs: Record<string, boolean> | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("business_settings")
      .select("notification_prefs")
      .eq("id", true)
      .maybeSingle();
    initialPrefs = (data?.notification_prefs ?? null) as Record<string, boolean> | null;
  }
  return <NotificationsView initialPrefs={initialPrefs} live={initialPrefs !== null} />;
}
