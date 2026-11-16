"use client";

import { GraduationCap } from "lucide-react";
import type { BookingRow } from "@/lib/types/db";
import {
  HATCH_STYLE,
  WEEKDAY_SHORT,
  bookingTint,
  isSameDay,
  isSameMonth,
  isWeekend,
  monthMatrix,
  type Lookup,
} from "./calendar-utils";

const MAX_CHIPS = 3;

export function MonthView({
  anchor,
  today,
  bookings,
  lookup,
  onSelectDay,
  onBookingClick,
  onBookingContextMenu,
}: {
  anchor: Date;
  /** Deterministic "today" (from server render). */
  today: Date;
  bookings: BookingRow[];
  lookup: Lookup;
  /** Switch to day view for the picked date. */
  onSelectDay: (day: Date) => void;
  onBookingClick: (b: BookingRow) => void;
  onBookingContextMenu?: (b: BookingRow, x: number, y: number) => void;
}) {
  const weeks = monthMatrix(anchor);

  return (
    <div className="card overflow-hidden" role="region" aria-label="Month grid">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_SHORT.map((label, i) => (
          <div
            key={label}
            className={`border-r border-divider px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] last:border-r-0 ${
              i >= 5 ? "text-muted" : "text-obsidian-light"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const inMonth = isSameMonth(day, anchor);
          const dayIsToday = isSameDay(day, today);
          const weekend = isWeekend(day);
          const dayBookings = bookings
            .filter((b) => isSameDay(new Date(b.starts_at), day))
            .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
          const visible = dayBookings.slice(0, MAX_CHIPS);
          const hidden = dayBookings.length - visible.length;

          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-[108px] flex-col border-b border-r border-divider p-1.5 align-top sm:min-h-[124px] ${
                (day.getDay() + 6) % 7 === 6 ? "border-r-0" : ""
              } ${dayIsToday ? "shadow-[inset_0_0_0_2px_var(--color-electric)]" : ""}`}
              style={weekend ? HATCH_STYLE : undefined}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                aria-label={`Open ${day.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })} in day view`}
                className={`flex h-7 w-7 items-center justify-center self-end rounded-full text-[12px] font-bold transition-colors hover:bg-electric-tint hover:text-electric ${
                  dayIsToday
                    ? "bg-electric text-white hover:bg-electric hover:text-white"
                    : inMonth
                      ? "text-obsidian"
                      : "text-black/25"
                }`}
              >
                {day.getDate()}
              </button>

              <div className="mt-1 flex min-w-0 flex-col gap-0.5">
                {visible.map((b) => {
                  const tint = bookingTint(b, lookup.categoryById);
                  const isFormation = b.type === "formation";
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onBookingClick(b)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onBookingContextMenu?.(b, e.clientX, e.clientY);
                      }}
                      title={b.title}
                      className={`flex min-w-0 items-center gap-1 rounded-[6px] border px-1.5 py-[3px] text-left text-[10px] font-semibold leading-tight transition-all hover:-translate-y-px hover:shadow-sm ${tint.block} ${b.status === "paused" || b.status === "cancelled" ? "opacity-55 border-dashed" : ""}`}
                    >
                      {isFormation && (
                        <GraduationCap
                          size={10}
                          strokeWidth={2.6}
                          aria-hidden="true"
                          className="shrink-0"
                        />
                      )}
                      <span className="truncate">{b.title}</span>
                    </button>
                  );
                })}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="rounded-[6px] px-1.5 py-[2px] text-left text-[10px] font-bold text-electric transition-colors hover:bg-electric-tint"
                  >
                    +{hidden} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
