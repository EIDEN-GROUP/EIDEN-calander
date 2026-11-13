/**
 * Formations — shared view-model helpers.
 * Demo data + derived display state. No backend calls.
 */

import { DEMO_FORMATIONS, DEMO_ROOMS, getDemoBookings, getDemoParticipants } from "@/lib/demo-data";
import type { BookingRow, FormationParticipantRow, FormationRow, RoomRow } from "@/lib/types/db";

export type EffectiveFormationStatus = "open" | "full" | "ongoing" | "completed" | "cancelled";

export interface FormationVM {
  booking: BookingRow;
  formation: FormationRow;
  participants: FormationParticipantRow[];
}

export function roomById(roomId: string | null): RoomRow | undefined {
  return DEMO_ROOMS.find((r) => r.id === roomId);
}

export function stripDemoSuffix(name: string): string {
  return name.replace(/ \(DEMO\)$/, "");
}

export function activeCount(participants: FormationParticipantRow[]): number {
  return participants.filter((p) => !p.waitlist && p.status !== "cancelled").length;
}

export function seatsLeft(formation: FormationRow, participants: FormationParticipantRow[]): number {
  return Math.max(0, formation.capacity - activeCount(participants));
}

export function fillPercent(formation: FormationRow, participants: FormationParticipantRow[]): number {
  if (formation.capacity <= 0) return 0;
  return Math.min(100, Math.round((activeCount(participants) / formation.capacity) * 100));
}

export function waitlistCount(participants: FormationParticipantRow[]): number {
  return participants.filter((p) => p.waitlist && p.status !== "cancelled").length;
}

export function effectiveStatus(vm: FormationVM, now: Date = new Date()): EffectiveFormationStatus {
  if (vm.formation.status === "cancelled") return "cancelled";
  const start = new Date(vm.booking.starts_at).getTime();
  const end = new Date(vm.booking.ends_at).getTime();
  const t = now.getTime();
  if (t >= end) return "completed";
  if (t >= start) return "ongoing";
  if (vm.formation.status === "full" || seatsLeft(vm.formation, vm.participants) <= 0) return "full";
  return "open";
}

/* ---------- formatting ---------- */

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fullDayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const shortDateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function formatDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export function formatFullDay(iso: string): string {
  return fullDayFmt.format(new Date(iso));
}

export function formatShortDate(d: Date): string {
  return shortDateFmt.format(d);
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/** Compact duration like "3h" or "1h 30m". */
export function formatDuration(startIso: string, endIso: string): string {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}`;
}

/** City shown as a compact badge: Casablanca → Casa, anything else verbatim. */
export function locationBadge(location: string | undefined): string {
  if (!location) return "—";
  return location === "Casablanca" ? "Casa" : location;
}

/** Group thousands with a regular space: 1200 → "1 200". */
export function formatMad(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " MAD";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Demo formations joined with their booking + a snapshot of participants. */
export function buildDemoVMs(): FormationVM[] {
  const bookings = getDemoBookings();
  const out: FormationVM[] = [];
  for (const formation of DEMO_FORMATIONS) {
    const booking = bookings.find((b) => b.id === formation.booking_id);
    if (!booking) continue;
    out.push({ booking, formation, participants: getDemoParticipants(formation.booking_id) });
  }
  return out;
}
