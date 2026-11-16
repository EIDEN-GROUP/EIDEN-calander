import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CategoriesView } from "@/components/settings/views/CategoriesView";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaCategories") };
}
export const instant = false;

export default async function CategoriesPage() {
  await connection();
  let initialCategories:
    | Array<{ id: string; name_en: string; name_fr: string | null; color: string; icon: string; type: "standard" | "formation"; is_system: boolean; is_active: boolean; sort: number }>
    | undefined;
  let live = false;
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase
      .from("categories")
      .select("id,name_en,name_fr,color,icon,type,is_system,is_active,sort")
      .order("sort");
    if (data) {
      initialCategories = data as typeof initialCategories;
      live = true;
    }
  }
  return <CategoriesView initialCategories={initialCategories} live={live} />;
}
