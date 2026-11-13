import type { Metadata } from "next";
import { connection } from "next/server";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export const metadata: Metadata = { title: "Calendar" };
// Rendered at request time — the now-line, today highlight and demo bookings
// (generated relative to the current hour) must reflect the moment of the visit.
export const instant = false;

export default async function CalendarPage() {
  await connection();
  // Server timestamp keeps SSR and hydration deterministic for "today".
  return <CalendarClient serverNow={new Date().toISOString()} />;
}
