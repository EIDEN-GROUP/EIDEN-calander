import type { Metadata } from "next";
import { InboxView } from "@/components/inbox/InboxView";

export const metadata: Metadata = { title: "Inbox" };
// searchParams (initial tab) is request-time data — block prerender.
export const instant = false;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string | string[] }>;
}) {
  const { folder } = await searchParams;
  const raw = Array.isArray(folder) ? folder[0] : folder;
  return <InboxView initialFolder={raw === "Sent" ? "Sent" : "INBOX"} />;
}
