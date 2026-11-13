import type { Metadata } from "next";
import { LocalizationView } from "@/components/settings/views/LocalizationView";

export const metadata: Metadata = { title: "Localization" };

export default function Page() {
  return <LocalizationView />;
}
