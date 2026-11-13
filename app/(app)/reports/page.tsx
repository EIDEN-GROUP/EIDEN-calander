import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsView } from "@/components/charts/ReportsView";

export const metadata: Metadata = { title: "Reports" };
// Chart buckets derive from today — stream the client view in, don't prerender it.
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

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsView />
    </Suspense>
  );
}
