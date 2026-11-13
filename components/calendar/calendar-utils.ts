/**
 * CALENDAR. — shared helpers for the calendar views (client-safe).
 * Pure functions; safe to use from both server and client components.
 */

import type { BookingRow, CategoryRow, RoomRow, ClientRow } from "@/lib/types/db";

export type CalendarView = "day" | "week" | "month" | "agenda";

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Inline hatch for weekend columns/cells (globals.css intentionally has no .hatch). */
export const HATCH_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(-45deg, rgba(0,0,0,0.04) 0 6px, transparent 6px 12px)",
  backgroundColor: "rgba(0,0,0,0.015)",
};

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Monday-first week start. */
export function startOfWeekMonday(d: Date): Date {
  const out = startOfDay(d);
  const offset = (out.getDay() + 6) % 7; // Mon = 0
  out.setDate(out.getDate() - offset);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDayLong(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Relative label used by suggestion chips: Today / Tomorrow / "Tue 17 Nov". */
export function relativeDayLabel(d: Date, today: Date): string {
  const start = startOfDay(today).getTime();
  const target = startOfDay(d).getTime();
  const diffDays = Math.round((target - start) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Range label for the navigation row, per active view. */
export function rangeLabel(view: CalendarView, anchor: Date): string {
  if (view === "day") return formatDayLong(anchor);
  if (view === "month")
    return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (view === "week") {
    const start = startOfWeekMonday(anchor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startStr = start.toLocaleDateString("en-GB", sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" });
    const endStr = end.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${startStr} – ${endStr}`;
  }
  if (view === "agenda") {
    const end = addDays(anchor, 13);
    const sameMonth = anchor.getMonth() === end.getMonth();
    const startStr = anchor.toLocaleDateString(
      "en-GB",
      sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" },
    );
    const endStr = end.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${startStr} – ${endStr}`;
  }
  // Exhaustive: CalendarView is covered above.
  return formatDayLong(anchor);
}

/** Monday-first month matrix (5–6 weeks), always whole weeks. */
export function monthMatrix(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeekMonday(first);
  const weeks: Date[][] = [];
  let cursor = start;
  // Always render 6 rows so the grid never jumps between months.
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(row);
  }
  return weeks;
}

/* ---------------- lookups & tints ---------------- */

export interface Lookup {
  roomById: Map<string, RoomRow>;
  categoryById: Map<string, CategoryRow>;
  clientById: Map<string, ClientRow>;
}

export function buildLookup(
  rooms: RoomRow[],
  categories: CategoryRow[],
  clients: ClientRow[],
): Lookup {
  return {
    roomById: new Map(rooms.map((r) => [r.id, r])),
    categoryById: new Map(categories.map((c) => [c.id, c])),
    clientById: new Map(clients.map((c) => [c.id, c])),
  };
}

/** Category color key → tint classes (brand book tint presets). */
export function tintFor(color: string | undefined): {
  block: string;
  chip: string;
  dot: string;
} {
  switch (color) {
    case "green":
      return {
        block: "bg-tint-green text-tint-fg-green border-[rgba(36,138,61,0.28)]",
        chip: "bg-tint-green text-tint-fg-green",
        dot: "bg-[#248a3d]",
      };
    case "purple":
      return {
        block: "bg-tint-purple text-tint-fg-purple border-[rgba(94,92,230,0.28)]",
        chip: "bg-tint-purple text-tint-fg-purple",
        dot: "bg-[#5e5ce6]",
      };
    case "amber":
      return {
        block: "bg-tint-amber text-tint-fg-amber border-[rgba(201,106,0,0.3)]",
        chip: "bg-tint-amber text-tint-fg-amber",
        dot: "bg-[#c96a00]",
      };
    case "teal":
      return {
        block: "bg-tint-teal text-tint-fg-teal border-[rgba(10,132,255,0.3)]",
        chip: "bg-tint-teal text-tint-fg-teal",
        dot: "bg-[#0a84ff]",
      };
    case "rose":
      return {
        block: "bg-tint-rose text-tint-fg-rose border-[rgba(216,27,96,0.28)]",
        chip: "bg-tint-rose text-tint-fg-rose",
        dot: "bg-[#d81b60]",
      };
    case "blue":
    default:
      return {
        block: "bg-tint-blue text-tint-fg-blue border-[rgba(0,102,204,0.28)]",
        chip: "bg-tint-blue text-tint-fg-blue",
        dot: "bg-electric",
      };
  }
}

/** Pending-conflict bookings always render with a dashed amber treatment. */
export const PENDING_BLOCK =
  "border border-dashed border-warning bg-warning-tint text-[#a34d00]";
export const PENDING_CHIP =
  "border border-dashed border-warning/70 bg-warning-tint text-[#a34d00]";

export function bookingTint(
  booking: BookingRow,
  categoryById: Map<string, CategoryRow>,
): { block: string; chip: string } {
  if (booking.status === "pending_conflict") {
    return { block: PENDING_BLOCK, chip: PENDING_CHIP };
  }
  const cat = categoryById.get(booking.category_id);
  const tint = tintFor(cat?.color);
  return { block: `border ${tint.block}`, chip: tint.chip };
}

/** Demo user ids → display names. */
export function creatorName(id: string | null | undefined): string {
  switch (id) {
    case "demo-admin":
      return "Marouane A.";
    case "demo-staff":
      return "Yasmine B.";
    default:
      return id ?? "Unknown";
  }
}

/** Short, stable human reference for an id (e.g. "A7F2"). */
export function shortRef(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(4, "0").slice(-4);
}
