import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { loadDashboard } from "@/lib/dashboard-live";
import { DashboardView } from "@/components/dashboard/DashboardView";

// Reads live data at request time — block prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("metaTitle") };
}

export default async function DashboardPage() {
  await connection();
  const data = await loadDashboard();
  return <DashboardView data={data} />;
}
