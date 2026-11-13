import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your profile" };

export default function Page() {
  return <EmptyState title="Your profile" description="Avatar, contact details, interface language and password — your personal settings." phase="2" />;
}
