/**
 * CALENDAR. — "please pick another slot" engine (pure, unit-tested).
 * Scans working hours from the desired day forward, returns the N nearest free
 * windows for a room at a fixed increment. Same-day-first ordering.
 */

import { isActiveBookingStatus, rangesOverlap, type OverlapCandidate } from "./conflict";

export interface WorkingHoursEntry {
  weekday: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  is_open: boolean;
  open_time: string;  // "08:00" or "08:00:00"
  close_time: string; // "20:00" or "20:00:00"
}

export interface SuggestSlotsOptions {
  roomId: string;
  /** Desired start (defaults to search from that day). */
  desiredStart: Date;
  durationMin: number;
  incrementMin?: 15 | 30 | 60;
  bufferMin?: number;
  /** How many days forward to scan (inclusive of desired day). */
  daysAhead?: number;
  /** Max suggestions returned. */
  limit?: number;
  /** Active bookings to avoid (any room or only this room — pass pre-filtered). */
  existing: OverlapCandidate[];
  /** Working-hours config for all 7 weekdays. */
  workingHours: WorkingHoursEntry[];
  /** IANA tz — slot wall-clock times are computed in this zone (default Africa/Casablanca). */
  timeZone?: string;
  /** For tests. */
  now?: Date;
}

export interface SlotSuggestion {
  startsAt: string; // ISO
  endsAt: string;   // ISO
  labelKey: string; // e.g. "today" | "tomorrow" | "date" — UI formats localized label
}

const WEEKDAY_INDEX: Record<WorkingHoursEntry["weekday"], number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/** Parse "HH:MM" / "HH:MM:SS" → minutes since midnight. */
export function parseTimeToMinutes(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Convert a wall-clock time in `timeZone` on a given calendar day to a UTC Date.
 * Uses Intl offset math — no external tz library required.
 */
export function zonedTimeToUtc(day: Date, minutes: number, timeZone: string): Date {
  // Build a guess in UTC, then measure the zone's offset at that guess and adjust.
  const y = day.getUTCFullYear();
  const mo = day.getUTCMonth();
  const d = day.getUTCDate();
  const guess = Date.UTC(y, mo, d, Math.floor(minutes / 60), minutes % 60);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour) % 24, Number(map.minute), Number(map.second ?? 0),
  );
  return asUtc - at.getTime();
}

function whFor(workingHours: WorkingHoursEntry[], jsDay: number): WorkingHoursEntry | undefined {
  return workingHours.find((w) => WEEKDAY_INDEX[w.weekday] === jsDay);
}

export function suggestSlots(opts: SuggestSlotsOptions): SlotSuggestion[] {
  const {
    desiredStart,
    durationMin,
    incrementMin = 30,
    bufferMin = 0,
    daysAhead = 14,
    limit = 4,
    existing,
    workingHours,
    timeZone = "Africa/Casablanca",
    now = new Date(),
  } = opts;

  if (durationMin <= 0) return [];

  const active = existing.filter((b) => isActiveBookingStatus(b.status));
  const suggestions: SlotSuggestion[] = [];

  // Normalize: calendar day in business tz. We work on UTC-day basis of the
  // desired instant, then compute wall-clock windows per that tz.
  const startDayUtc = Date.UTC(
    desiredStart.getUTCFullYear(),
    desiredStart.getUTCMonth(),
    desiredStart.getUTCDate(),
  );

  for (let offset = 0; offset < daysAhead && suggestions.length < limit; offset++) {
    const dayUtc = startDayUtc + offset * 86400000;
    const jsDay = new Date(dayUtc).getUTCDay();
    const wh = whFor(workingHours, jsDay);
    if (!wh || !wh.is_open) continue;

    const openMin = parseTimeToMinutes(wh.open_time);
    const closeMin = parseTimeToMinutes(wh.close_time);
    if (closeMin - openMin < durationMin) continue;

    for (let t = openMin; t + durationMin <= closeMin && suggestions.length < limit; t += incrementMin) {
      // Don't propose slots that end before right now.
      const slotStart = zonedTimeToUtc(new Date(dayUtc), t, timeZone);
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60000);
      if (slotEnd.getTime() <= now.getTime()) continue;

      // Buffer: bookings within bufferMin of the desired window also block it.
      const conflict = active.some((b) =>
        rangesOverlap(
          new Date(slotStart.getTime() - bufferMin * 60000),
          new Date(slotEnd.getTime() + bufferMin * 60000),
          b.starts_at,
          b.ends_at,
        ),
      );
      if (conflict) continue;

      suggestions.push({
        startsAt: slotStart.toISOString(),
        endsAt: slotEnd.toISOString(),
        labelKey: offset === 0 ? "today" : offset === 1 ? "tomorrow" : "date",
      });
    }
  }

  return suggestions;
}
