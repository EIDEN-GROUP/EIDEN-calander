import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { MailView } from "@/components/settings/views/MailView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("tabMail") };
}

export default function Page() {
  const t = useTranslations("settings");
  const mailboxAddress = (process.env.MAILBOX_ALLOWED ?? process.env.IMAP_USER ?? t("mailboxNotConfigured")).trim();
  return <MailView mailboxAddress={mailboxAddress} />;
}

// Reads env at request time — block prerender.
export const instant = false;
