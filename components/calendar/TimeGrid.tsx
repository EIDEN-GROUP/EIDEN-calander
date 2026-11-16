"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { GraduationCap } from "lucide-react";
import type { BookingRow } from "@/lib/types/db";
import {
  HATCH_STYLE,
  WEEKDAY_SHORT,
  bookingTint,
  formatDayLong,
  formatTimeRange,
  isSameDay,
  isWeekend,
  minutesOf,
  type Lookup,
} from "./calendar-utils";

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 56;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const HALF_HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR * 60 + i * 60 + 30,
);

const gridTemplate = (cols: number): CSSProperties => ({
  gridTemplateColumns: `56px repeat(${cols}, minmax(0, 1fr))`,
});

function snap(m: number): number {
  return Math.min(Math.max(Math.round(m / 15) * 15, START_HOUR * 60), END_HOUR * 60);
}

export interface TimeGridProps {
  /** 1 day (day view) or 7 days (week view, Monday-first). */
  days: Date[];
  bookings: BookingRow[];
  lookup: Lookup;
  /** ISO timestamp used for deterministic first render (SSR/CSR). */
  serverNow: string;
  onBookingClick: (booking: BookingRow) => void;
  onCreateRange: (day: Date, startsAt: Date, endsAt: Date) => void;
  onBookingContextMenu?: (booking: BookingRow, x: number, y: number) => void;
}

export function TimeGrid({
  days,
  bookings,
  lookup,
  serverNow,
  onBookingClick,
  onCreateRange,
  onBookingContextMenu,
}: TimeGridProps) {
  const [now, setNow] = useState<Date>(() => new Date(serverNow));
  const [drag, setDrag] = useState<{
    dayIndex: number;
    anchorMin: number;
    currentMin: number;
  } | null>(null);
  const dragRectRef = useRef<DOMRect | null>(null);
  const dragRef = useRef<{ dayIndex: number; anchorMin: number } | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const today = startOfDayLocal(now);
  const nowMinutes = minutesOf(now);
  const nowInRange = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
  const showNowLine = nowInRange && days.some((d) => isSameDay(d, today));
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_PX;

  const layouts = useMemo(
    () => days.map((day) => layoutDay(bookings, day)),
    [days, bookings],
  );

  /* ---------- drag-to-create ---------- */
  const handleColumnMouseDown =
    (dayIndex: number) => (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-booking]")) return;
      dragRectRef.current = e.currentTarget.getBoundingClientRect();
      const rect = dragRectRef.current;
      const y = Math.min(Math.max(e.clientY - rect.top, 0), (END_HOUR - START_HOUR) * HOUR_PX);
      const m = snap(START_HOUR * 60 + (y / HOUR_PX) * 60);
      dragRef.current = { dayIndex, anchorMin: m };
      setDrag({ dayIndex, anchorMin: m, currentMin: m });
      e.preventDefault();
    };

  const dragActive = drag !== null;
  useEffect(() => {
    if (!dragActive) return;
    // Capture the drag session that just became active; currentMin updates
    // flow through state, anchor/day stay frozen for the gesture.
    const session = dragRef.current;
    if (!session) return;
    const rect = dragRectRef.current;
    const minutesFrom = (clientY: number): number => {
      if (!rect) return START_HOUR * 60;
      const y = Math.min(Math.max(clientY - rect.top, 0), (END_HOUR - START_HOUR) * HOUR_PX);
      return START_HOUR * 60 + (y / HOUR_PX) * 60;
    };
    const onMove = (e: MouseEvent) => {
      const m = snap(minutesFrom(e.clientY));
      setDrag((d) => (d ? { ...d, currentMin: m } : d));
    };
    const onUp = (e: MouseEvent) => {
      const m = snap(minutesFrom(e.clientY));
      dragRef.current = null;
      const lo = Math.min(session.anchorMin, m);
      const hi = Math.max(session.anchorMin, m);
      if (hi - lo >= 15) {
        const day = days[session.dayIndex];
        const startsAt = new Date(day);
        startsAt.setHours(0, 0, 0, 0);
        startsAt.setMinutes(lo);
        const endsAt = new Date(day);
        endsAt.setHours(0, 0, 0, 0);
        endsAt.setMinutes(hi);
        onCreateRange(day, startsAt, endsAt);
      }
      setDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragActive, days, onCreateRange]);

  const minWidth = days.length > 1 ? "min-w-[760px]" : "min-w-[420px]";

  return (
    <div
      className="card overflow-hidden"
      role="region"
      aria-label="Time grid"
    >
      <div className="overflow-x-auto">
        <div className={minWidth}>
          {/* Day header row */}
          <div className="grid border-b border-border" style={gridTemplate(days.length)}>
            <div className="border-r border-divider" aria-hidden="true" />
            {days.map((day) => {
              const dayIsToday = isSameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={`flex items-center justify-center gap-2 border-r border-divider px-2 py-2.5 last:border-r-0 ${
                    isWeekend(day) ? "text-muted" : ""
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                    {WEEKDAY_SHORT[(day.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-pill text-[14px] font-bold ${
                      dayIsToday ? "bg-electric text-white" : "text-obsidian"
                    }`}
                    aria-current={dayIsToday ? "date" : undefined}
                  >
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Grid body */}
          <div className="relative grid" style={gridTemplate(days.length)}>
            {/* Hour gutter */}
            <div className="relative border-r border-divider" aria-hidden="true">
              {HOURS.map((h) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted"
                  style={{ top: (h - START_HOUR) * HOUR_PX }}
                >
                  {pad2(h)}:00
                </span>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, i) => {
              const weekend = isWeekend(day);
              return (
                <div
                  key={day.toISOString()}
                  role="group"
                  aria-label={formatDayLong(day)}
                  data-day-index={i}
                  onMouseDown={handleColumnMouseDown(i)}
                  className="relative cursor-cell touch-none select-none border-r border-divider last:border-r-0"
                  style={{
                    height: (END_HOUR - START_HOUR) * HOUR_PX,
                    ...(weekend ? HATCH_STYLE : null),
                  }}
                >
                  {/* Hour lines */}
                  {HOURS.slice(1).map((h) => (
                    <div
                      key={h}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 border-t border-divider"
                      style={{ top: (h - START_HOUR) * HOUR_PX }}
                    />
                  ))}
                  {HALF_HOURS.map((m) => (
                    <div
                      key={m}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-divider"
                      style={{ top: ((m - START_HOUR * 60) / 60) * HOUR_PX }}
                    />
                  ))}

                  {/* Drag ghost */}
                  {drag && drag.dayIndex === i && drag.currentMin !== drag.anchorMin && (() => {
                    const lo = Math.min(drag.anchorMin, drag.currentMin);
                    const hi = Math.max(drag.anchorMin, drag.currentMin);
                    return (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-1 z-10 rounded-sm border border-dashed border-electric bg-electric-tint px-1.5 py-1"
                        style={{
                          top: ((lo - START_HOUR * 60) / 60) * HOUR_PX,
                          height: ((hi - lo) / 60) * HOUR_PX,
                        }}
                      >
                        <span className="text-[10px] font-bold tabular-nums text-electric">
                          {minutesLabel(lo)} – {minutesLabel(hi)}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Bookings */}
                  {layouts[i].map(({ booking, lane, lanes }) => {
                    const bStart = new Date(booking.starts_at);
                    const bEnd = new Date(booking.ends_at);
                    const top = Math.max(
                      0,
                      ((minutesOf(bStart) - START_HOUR * 60) / 60) * HOUR_PX,
                    );
                    const rawHeight =
                      ((minutesOf(bEnd) - minutesOf(bStart)) / 60) * HOUR_PX;
                    const height = Math.max(18, rawHeight);
                    const tint = bookingTint(booking, lookup.categoryById);
                    const isFormation = booking.type === "formation";
                    const isPending = booking.status === "pending_conflict";
                    const isPaused = booking.status === "paused";
                    const laneWidth = 100 / lanes;
                    return (
                      <button
                        key={booking.id}
                        type="button"
                        data-booking
                        onClick={() => onBookingClick(booking)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onBookingContextMenu?.(booking, e.clientX, e.clientY);
                        }}
                        aria-label={`${booking.title}, ${formatDayLong(bStart)}, ${formatTimeRange(bStart, bEnd)}${
                          isPending ? ", pending conflict" : ""
                        }`}
                        className={`absolute overflow-hidden rounded-sm border px-1.5 py-1 text-left align-top transition-shadow hover:z-20 hover:shadow-md focus-visible:z-20 ${tint.block} ${
                          booking.status === "completed" || booking.status === "cancelled" || booking.status === "paused"
                            ? "opacity-60"
                            : ""
                        } ${isPaused ? "border-dashed border-warning/60" : ""}`}
                        style={{
                          top,
                          height,
                          left: `calc(${lane * laneWidth}% + 2px)`,
                          width: `calc(${laneWidth}% - 4px)`,
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-1">
                          {isPaused && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
                              <rect x="6" y="4" width="4" height="16" rx="1.2" />
                              <rect x="14" y="4" width="4" height="16" rx="1.2" />
                            </svg>
                          )}
                          {isFormation && (
                            <GraduationCap
                              size={11}
                              strokeWidth={2.4}
                              aria-hidden="true"
                              className="shrink-0"
                            />
                          )}
                          <span className="truncate text-[11px] font-bold leading-tight">
                            {booking.title}
                          </span>
                        </span>
                        {height >= 34 && (
                          <span className="mt-0.5 block truncate text-[9.5px] font-semibold tabular-nums opacity-80">
                            {formatTimeRange(bStart, bEnd)}
                            {isPending && height < 52 ? " · Pending" : ""}
                          </span>
                        )}
                        {isPending && height >= 52 && (
                          <span className="mt-1 inline-flex items-center rounded-pill border border-dashed border-warning/70 bg-white/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#a34d00]">
                            Pending
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Now-line across the grid (only when today is visible) */}
            {showNowLine && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-10"
                style={{ top: nowTop, left: 56, right: 0, height: 0 }}
              >
                <div className="relative h-[2px] w-full bg-electric">
                  <span className="absolute -left-1 -top-[5px] h-3 w-3 rounded-full border-2 border-surface bg-electric shadow-sm" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minutesLabel(mins: number): string {
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

function startOfDayLocal(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

interface LayoutItem {
  booking: BookingRow;
  lane: number;
  lanes: number;
}

/** Assign side-by-side lanes to overlapping bookings (Google-Calendar style). */
function layoutDay(bookings: BookingRow[], day: Date): LayoutItem[] {
  const dayStart = startOfDayLocal(day).getTime();
  const dayEnd = dayStart + 86400000;
  const items = bookings
    .map((b) => ({ b, s: new Date(b.starts_at).getTime(), e: new Date(b.ends_at).getTime() }))
    .filter(({ s, e }) => s < dayEnd && e > dayStart)
    .sort((a, b) => a.s - b.s || a.e - b.e);

  const out: LayoutItem[] = [];
  let group: typeof items = [];
  let groupEnd = -1;

  const flush = () => {
    if (group.length === 0) return;
    const laneEnds: number[] = [];
    const assigned: Array<{ b: BookingRow; lane: number }> = [];
    for (const { b, s, e } of group) {
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(e);
      } else {
        laneEnds[lane] = e;
      }
      assigned.push({ b, lane });
    }
    const lanes = laneEnds.length;
    for (const a of assigned) out.push({ booking: a.b, lane: a.lane, lanes });
    group = [];
    groupEnd = -1;
  };

  for (const item of items) {
    if (group.length > 0 && item.s >= groupEnd) flush();
    group.push(item);
    groupEnd = Math.max(groupEnd, item.e);
  }
  flush();

  return out;
}
