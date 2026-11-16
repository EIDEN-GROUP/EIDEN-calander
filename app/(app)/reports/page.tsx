import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ReportsView } from "@/components/charts/ReportsView";
import { loadReports } from "@/lib/reports-live";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}
// Reads live data at request time — block prerender.
export const instant = false;

function ReportsFallback() {
  return (
    <div className="mx-auto max-w-[1440px]" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-pill bg-track" />
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 animate-pulse" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-72 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default async function ReportsPage() {
  await connection();
  const live = await loadReports();
  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsView live={live} />
    </Suspense>
  );
}
