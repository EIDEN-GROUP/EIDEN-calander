import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InboxView } from "@/components/inbox/InboxView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("metaInboxTitle") };
}
// searchParams (initial tab) is request-time data — block prerender.
export const instant = false;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string | string[] }>;
}) {
  const { folder } = await searchParams;
  const t = await getTranslations("inbox");
  const raw = Array.isArray(folder) ? folder[0] : folder;
  const mailboxAddress = (process.env.MAILBOX_ALLOWED ?? process.env.IMAP_USER ?? t("mailboxNotConfigured")).trim().toLowerCase();
  return <InboxView initialFolder={raw === "Sent" ? "Sent" : "INBOX"} mailboxAddress={mailboxAddress} />;
}
