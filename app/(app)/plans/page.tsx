import type { Metadata } from "next";
import { Suspense } from "react";
import { PlansBoard } from "@/components/plans/PlansBoard";
import { loadPlans } from "@/lib/plans-live";

export const metadata: Metadata = { title: "Plans" };
// Reads live data at request time — block prerender.
export const instant = false;

function BoardFallback() {
  return (
    <div className="mx-auto max-w-6xl" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-pill bg-track" />
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-64 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default async function PlansPage() {
  const data = await loadPlans();
  return (
    <Suspense fallback={<BoardFallback />}>
      <PlansBoard data={data} />
    </Suspense>
  );
}
