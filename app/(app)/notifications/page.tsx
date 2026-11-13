import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return <EmptyState title="Notifications" description="Mentions, confirmations and change-request updates — grouped by day, realtime." phase="2" />;
}
