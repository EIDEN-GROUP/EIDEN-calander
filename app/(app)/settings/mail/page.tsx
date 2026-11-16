import type { Metadata } from "next";
import { MailView } from "@/components/settings/views/MailView";

export const metadata: Metadata = { title: "Mail" };

export default function Page() {
  const mailboxAddress = (process.env.MAILBOX_ALLOWED ?? process.env.IMAP_USER ?? "mailbox not configured").trim();
  return <MailView mailboxAddress={mailboxAddress} />;
}

// Reads env at request time — block prerender.
export const instant = false;
