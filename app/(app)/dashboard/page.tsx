import { connection } from "next/server";
import { loadDashboard } from "@/lib/dashboard-live";
import { DashboardView } from "@/components/dashboard/DashboardView";

// Time-dependent + live data — render at request time.
export const instant = false;

export default async function DashboardPage() {
  await connection();
  const data = await loadDashboard();
  return <DashboardView data={data} />;
}
