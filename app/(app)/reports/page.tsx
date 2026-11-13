import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <EmptyState title="Reports" description="Bookings, utilization and revenue per room and per location (Casablanca / Agadir), formation fill-rate and attendance — exportable to CSV." phase="3" />;
}
