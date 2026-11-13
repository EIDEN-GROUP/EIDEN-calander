import type { Metadata } from "next";
import { MailView } from "@/components/settings/views/MailView";

export const metadata: Metadata = { title: "Mail" };

export default function Page() {
  return <MailView />;
}
