"use client";

import { CalendarDays, DoorOpen, GraduationCap, Users } from "lucide-react";
import type { BookingRow } from "@/lib/types/db";
import {
  addDays,
  bookingTint,
  formatDayLong,
  formatTime,
  isSameDay,
  relativeDayLabel,
  tintFor,
  type Lookup,
} from "./calendar-utils";

/* ================= Day agenda (right rail, day view) ================= */

export function DayTimeline({
  day,
  bookings,
  lookup,
  onBookingClick,
}: {
  day: Date;
  bookings: BookingRow[];
  lookup: Lookup;
  onBookingClick: (b: BookingRow) => void;
}) {
  const dayBookings = bookings
    .filter((b) => isSameDay(new Date(b.starts_at), day))
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));

  return (
    <aside
      aria-label="Day agenda"
      className="card flex flex-col p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-extrabold uppercase tracking-[0.1em] text-obsidian-light">
          Agenda
        </h2>
        <span className="chip bg-electric-tint text-[11px] text-electric">
          {dayBookings.length} {dayBookings.length === 1 ? "booking" : "bookings"}
        </span>
      </div>
      <ol className="mt-4 flex-1">
        {dayBookings.length === 0 && (
          <li className="rounded-sm border border-dashed border-border bg-canvas/60 px-4 py-8 text-center">
            <CalendarDays size={22} className="mx-auto text-muted" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-semibold text-obsidian-light">
              Nothing scheduled
            </p>
            <p className="mt-0.5 text-[12px] text-muted">Enjoy the quiet.</p>
          </li>
        )}
        {dayBookings.map((b, i) => (
          <TimelineItem
            key={b.id}
            booking={b}
            lookup={lookup}
            last={i === dayBookings.length - 1}
            onBookingClick={onBookingClick}
          />
        ))}
      </ol>
    </aside>
  );
}

function TimelineItem({
  booking,
  lookup,
  last,
  onBookingClick,
}: {
  booking: BookingRow;
  lookup: Lookup;
  last: boolean;
  onBookingClick: (b: BookingRow) => void;
}) {
  const start = new Date(booking.starts_at);
  const room = booking.room_id ? lookup.roomById.get(booking.room_id) : null;
  const client = booking.client_id ? lookup.clientById.get(booking.client_id) : null;
  const tint = bookingTint(booking, lookup.categoryById);

  return (
    <li className="relative flex gap-3 pb-4">
      {/* Time rail */}
      <div className="flex w-11 shrink-0 flex-col items-end pt-0.5">
        <span className="text-[12px] font-bold tabular-nums leading-tight text-obsidian">
          {formatTime(start)}
        </span>
      </div>
      {/* Line + dot */}
      <div className="relative flex w-3 shrink-0 justify-center" aria-hidden="true">
        <span
          className={`absolute top-2 h-2.5 w-2.5 rounded-full ${
            booking.status === "pending_conflict" ? "bg-warning" : "bg-electric"
          }`}
        />
        {!last && <span className="absolute bottom-0 top-5 w-px bg-divider" />}
      </div>
      {/* Content */}
      <button
        type="button"
        onClick={() => onBookingClick(booking)}
        className="min-w-0 flex-1 rounded-sm border border-border bg-white p-2.5 text-left transition-shadow hover:shadow-md"
      >
        <span className={`chip ${tint.chip} !text-[10px] uppercase tracking-[0.05em]`}>
          {booking.status === "pending_conflict"
            ? "Pending"
            : booking.type === "formation"
              ? "Formation"
              : "Booked"}
        </span>
        <span className="mt-1.5 block truncate text-[13px] font-bold leading-snug text-obsidian">
          {booking.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium text-muted">
          {room && (
            <span className="inline-flex items-center gap-1">
              <DoorOpen size={11} strokeWidth={2} aria-hidden="true" />
              {room.name.replace(/\s*\(DEMO\)\s*$/, "")}
            </span>
          )}
          {client && (
            <span className="inline-flex items-center gap-1">
              <Users size={11} strokeWidth={2} aria-hidden="true" />
              {client.full_name}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/* ================= Agenda view (next 14 days) ================= */

export function AgendaView({
  today,
  windowStart,
  bookings,
  lookup,
  onBookingClick,
}: {
  /** Real current day (for relative labels). */
  today: Date;
  /** First day of the 14-day window (steps with prev/next). */
  windowStart: Date;
  bookings: BookingRow[];
  lookup: Lookup;
  onBookingClick: (b: BookingRow) => void;
}) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(windowStart, i));
  const groups = days
    .map((day) => ({
      day,
      items: bookings
        .filter((b) => isSameDay(new Date(b.starts_at), day))
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
        <CalendarDays size={40} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
        <h2 className="mt-4 text-[18px] font-extrabold tracking-[-0.02em] text-obsidian">
          No bookings in the next 14 days
        </h2>
        <p className="mt-1 max-w-sm text-[13px] leading-snug text-obsidian-light">
          When the team books rooms or formations, they’ll show up here — grouped by day,
          soonest first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-label="Agenda, next 14 days">
      {groups.map(({ day, items }) => (
        <section
          key={day.toISOString()}
          aria-label={formatDayLong(day)}
          className="card flex flex-col gap-4 p-4 sm:flex-row sm:gap-6 sm:p-5"
        >
          {/* Date block */}
          <div className="flex shrink-0 items-center gap-3 sm:w-36 sm:flex-col sm:items-start sm:gap-0 sm:border-r sm:border-divider sm:pr-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              {relativeDayLabel(day, today)}
            </span>
            <span className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-obsidian sm:mt-1.5">
              {day.getDate()}{" "}
              <span className="text-[13px] font-bold text-obsidian-light">
                {day.toLocaleDateString("en-GB", { month: "short" })}
              </span>
            </span>
            <span className="text-[11px] font-semibold text-muted sm:mt-1">
              {items.length} {items.length === 1 ? "booking" : "bookings"}
            </span>
          </div>

          {/* Bookings */}
          <ul className="min-w-0 flex-1 divide-y divide-divider">
            {items.map((b) => {
              const start = new Date(b.starts_at);
              const end = new Date(b.ends_at);
              const room = b.room_id ? lookup.roomById.get(b.room_id) : null;
              const client = b.client_id ? lookup.clientById.get(b.client_id) : null;
              const tint = bookingTint(b, lookup.categoryById);
              const isFormation = b.type === "formation";
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onBookingClick(b)}
                    className="group flex w-full items-center gap-3 py-2.5 text-left sm:gap-4"
                  >
                    <span className="w-[92px] shrink-0 text-[12px] font-bold tabular-nums text-obsidian">
                      {formatTime(start)}
                      <span className="block text-[10px] font-semibold text-muted">
                        → {formatTime(end)}
                      </span>
                    </span>
                    <span
                      className={`h-9 w-1 shrink-0 rounded-pill ${
                        b.status === "pending_conflict"
                          ? "bg-warning"
                          : tintFor(lookup.categoryById.get(b.category_id)?.color).dot
                      }`}
                      aria-hidden="true"
                    />
                    {isFormation && (
                      <GraduationCap
                        size={15}
                        strokeWidth={2.2}
                        className="shrink-0 text-tint-fg-green"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-obsidian transition-colors group-hover:text-electric">
                        {b.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-muted">
                        {room ? room.name.replace(/\s*\(DEMO\)\s*$/, "") : "Off-site"}
                        {client ? ` · ${client.full_name}` : ""}
                        {b.status === "pending_conflict" ? " · Pending conflict" : ""}
                      </span>
                    </span>
                    <span className={`chip shrink-0 ${tint.chip} hidden sm:inline-flex`}>
                      {b.status === "pending_conflict" ? "Pending" : isFormation ? "Formation" : "Booked"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
