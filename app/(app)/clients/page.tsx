import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientsClient } from "@/components/clients/ClientsClient";
import { loadClients } from "@/lib/clients-live";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clients");
  return { title: t("metaTitle") };
}
export const instant = false;

export default async function ClientsPage() {
  await connection();
  const data = await loadClients();
  return <ClientsClient data={data} />;
}
