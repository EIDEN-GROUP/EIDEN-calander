import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { loadCalendarData } from "@/lib/live-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("metaTitle") };
}
// Reads live data at request time — block prerender.
export const instant = false;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await connection();
  const { client } = await searchParams;
  const data = await loadCalendarData();
  return (
    <CalendarClient
      serverNow={new Date().toISOString()}
      data={data}
      prefillClientId={client ?? null}
    />
  );
}
