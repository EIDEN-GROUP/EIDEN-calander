import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Formations" };

export default function Page() {
  return <EmptyState title="Formations" description="Training sessions with capacity, waitlists, CSV roster import and day-of attendance — built as bookings, powered by the same conflict engine." phase="3" />;
}
