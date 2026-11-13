import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plans" };

export default function Page() {
  return <EmptyState title="Plans" description="Strategic objectives with tasks, assignees, due dates and auto-computed progress — the planning side of CALENDAR." phase="3" />;
}
