import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataPrivacyView, type LedgerClient } from "@/components/settings/views/DataPrivacyView";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("tabData") };
}
export const instant = false;

export default async function Page() {
  await connection();
  const supabase = await createClient();
  let clients: LedgerClient[] | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("clients")
      .select("id,full_name,company,email,city,status,anonymized_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) {
      clients = data as LedgerClient[];
    }
  }
  return <DataPrivacyView initialClients={clients ?? []} live={clients !== null} />;
}
