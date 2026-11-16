import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPane } from "@/components/inbox/ReadingPane";
import type { MailFolder } from "@/components/inbox/types";

export const metadata: Metadata = { title: "Message" };
// params + searchParams are request-time data — block prerender.
export const instant = false;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folder?: string | string[] }>;
}) {
  const { id } = await params;
  const { folder } = await searchParams;
  const uid = Number(id);
  if (!Number.isInteger(uid) || uid < 1 || uid > 2_147_483_647) notFound();
  const raw = Array.isArray(folder) ? folder[0] : folder;
  const initialFolder: MailFolder = raw === "Sent" ? "Sent" : "INBOX";
  const mailboxAddress = (process.env.MAILBOX_ALLOWED ?? process.env.IMAP_USER ?? "mailbox not configured").trim().toLowerCase();
  return <ReadingPane uid={uid} folder={initialFolder} mailboxAddress={mailboxAddress} />;
}
