import type { Metadata } from "next";
import { DataPrivacyView } from "@/components/settings/views/DataPrivacyView";

export const metadata: Metadata = { title: "Data & Privacy" };

export default function Page() {
  return <DataPrivacyView />;
}
