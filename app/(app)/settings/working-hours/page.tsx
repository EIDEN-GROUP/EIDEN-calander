import type { Metadata } from "next";
import { WorkingHoursView } from "@/components/settings/views/WorkingHoursView";

export const metadata: Metadata = { title: "Working Hours" };

export default function Page() {
  return <WorkingHoursView />;
}
