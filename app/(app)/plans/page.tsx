import type { Metadata } from "next";
import { Suspense } from "react";
import { PlansBoard } from "@/components/plans/PlansBoard";

export const metadata: Metadata = { title: "Plans" };
// Board derives overdue state from today — stream the client view in, don't prerender it.
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

export default function PlansPage() {
  return (
    <Suspense fallback={<BoardFallback />}>
      <PlansBoard />
    </Suspense>
  );
}
