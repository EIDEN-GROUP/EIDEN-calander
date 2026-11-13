import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clients" };

export default function Page() {
  return <EmptyState title="Clients" description="CRM-lite: search, tags, status, booking history, formation enrollments, GDPR export and anonymize." phase="3" />;
}
