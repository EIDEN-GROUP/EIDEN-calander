import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FormationDetailClient } from "@/components/formations/FormationDetailClient";
import { loadFormation } from "@/lib/formation-vms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("formations");
  return { title: t("detailTitle") };
}
export const instant = false;

export default async function FormationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const live = await loadFormation(id);
  if (!live && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Configured but missing → 404 (unknown id). Demo mode (unconfigured) → client renders its demo/empty path.
    notFound();
  }
  return <FormationDetailClient id={id} data={live} />;
}
