import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientDetailClient } from "@/components/clients/ClientDetailClient";
import { loadClient } from "@/lib/clients-live";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clients");
  return { title: t("metaTitleDetail") };
}
// Dynamic by client id: block prerender.
export const instant = false;

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const live = await loadClient(id);
  if (!live && process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();
  return <ClientDetailClient id={id} data={live} />;
}
