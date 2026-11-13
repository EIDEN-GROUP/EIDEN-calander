import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return <EmptyState title="Calendar" description="Day, Week, Month and Agenda views with live double-booking detection, suggested slots and the change-request flow." phase="2" />;
}
