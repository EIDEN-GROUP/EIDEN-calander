import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FormationsClient } from "@/components/formations/FormationsClient";
import { loadFormations } from "@/lib/formation-vms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("formations");
  return { title: t("title") };
}
export const instant = false;

export default async function FormationsPage() {
  await connection();
  const live = await loadFormations();
  return <FormationsClient data={live} />;
}
