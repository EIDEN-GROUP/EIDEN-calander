import type { Metadata } from "next";
import { GeneralView } from "@/components/settings/views/GeneralView";

export const metadata: Metadata = { title: "General" };

export default function Page() {
  return <GeneralView />;
}
