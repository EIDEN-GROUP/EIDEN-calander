import type { Metadata } from "next";
import { PlanDetail } from "@/components/plans/PlanDetail";

export const metadata: Metadata = { title: "Plan" };
// Dynamic by plan id + today-relative dates — block prerender.
export const instant = false;

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlanDetail id={id} />;
}
