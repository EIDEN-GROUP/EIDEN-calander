import type { Metadata } from "next";
import { connection } from "next/server";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { loadCalendarData } from "@/lib/live-data";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  await connection();
  const data = await loadCalendarData();
  return <CalendarClient serverNow={new Date().toISOString()} data={data} />;
}
