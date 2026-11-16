import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlanDetail } from "@/components/plans/PlanDetail";
import { loadPlan } from "@/lib/plans-live";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plans");
  return { title: t("planTitle") };
}
// Dynamic by plan id + today-relative dates — block prerender.
export const instant = false;

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const live = await loadPlan(id);
  if (!live && process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();
  return <PlanDetail id={id} data={live} />;
}
