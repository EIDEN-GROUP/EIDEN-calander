import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inbox" };

export default function Page() {
  return <EmptyState title="Inbox" description="Read and reply to contact@eiden-group.com right here — hosted mail, one mailbox only, reply via SMTP." phase="3" />;
}
