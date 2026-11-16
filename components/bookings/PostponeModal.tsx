"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarClock, TriangleAlert, CheckCircle2, X, Loader2 } from "lucide-react";
import { findOverlaps } from "@/lib/conflict";
import { suggestSlots, type WorkingHoursEntry } from "@/lib/slots";
import { postponeBookingAction } from "@/app/actions/bookings";
import type { BookingRow } from "@/lib/types/db";
import { formatTimeRange, relativeDayLabel, startOfDay } from "@/components/calendar/calendar-utils";
import { useModalA11y } from "@/components/bookings/focus-trap";
import { useTranslations, useLocale } from "next-intl";
import { useRef } from "react";
import { appLocaleTag } from "@/lib/intl-locale";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parseLocal(date: string, time: string) {
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function PostponeModal({
  booking,
  bookings,
  workingHours,
  onClose,
  onDone,
}: {
  booking: BookingRow;
  bookings: BookingRow[];
  workingHours?: WorkingHoursEntry[];
  onClose: () => void;
  onDone: (startsAt: string, endsAt: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("common");
  const intlLocale = appLocaleTag(useLocale());
  useModalA11y(panelRef, onClose, true);

  const [date, setDate] = useState(() => toDateInput(new Date(booking.starts_at)));
  const [startTime, setStartTime] = useState(() => toTimeInput(new Date(booking.starts_at)));
  const [endTime, setEndTime] = useState(() => toTimeInput(new Date(booking.ends_at)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = parseLocal(date, startTime);
  const end = parseLocal(date, endTime);
  const timesValid = !!start && !!end && end.getTime() > start.getTime();

  const conflicts = useMemo(() => {
    if (!timesValid || !start || !end || !booking.room_id) return [];
    return findOverlaps(booking.room_id, start, end, bookings, booking.id);
  }, [timesValid, start, end, booking.room_id, booking.id, bookings]);

  const durationMin = timesValid && start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
  const suggestions = useMemo(() => {
    if (!timesValid || !start || durationMin <= 0 || !booking.room_id) return [];
    return suggestSlots({
      roomId: booking.room_id,
      desiredStart: start,
      durationMin,
      incrementMin: 30,
      bufferMin: 0,
      daysAhead: 14,
      limit: 4,
      existing: bookings,
      workingHours: workingHours ?? [],
      timeZone: "Africa/Casablanca",
    });
  }, [timesValid, start, durationMin, booking.room_id, bookings, workingHours]);

  const hasConflicts = conflicts.length > 0;
  const today = startOfDay(new Date());

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!timesValid || !start || !end) {
      setError(t("postponeErrorEndBeforeStart"));
      return;
    }
    if (hasConflicts) {
      setError(t("postponeErrorClashes"));
      return;
    }
    setSaving(true);
    try {
      const res = await postponeBookingAction({
        bookingId: booking.id,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      if ("conflict" in res.data) {
        setError(t("postponeErrorTaken"));
        return;
      }
      onDone(start.toISOString(), end.toISOString());
    } catch {
      setError(t("postponeErrorGeneric"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label={t("postponeTitle")}>
      <button
        type="button"
        aria-label={t("close")}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-obsidian/40 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        className="absolute left-1/2 top-1/2 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-white shadow-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-divider p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-electric-tint text-electric">
              <CalendarClock size={20} strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-extrabold leading-snug tracking-[-0.02em] text-obsidian">
                {t("postponeTitle")}
              </h2>
              <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-obsidian-light">{booking.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="rounded-pill p-2 text-muted transition-colors hover:bg-black/[0.04] hover:text-obsidian"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-5">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
            <div className="col-span-1">
              <label htmlFor="pp-date" className="label">{t("postponeDate")}</label>
              <input id="pp-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-span-1">
              <label htmlFor="pp-start" className="label">{t("postponeStart")}</label>
              <input id="pp-start" type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="col-span-1">
              <label htmlFor="pp-end" className="label">{t("postponeEnd")}</label>
              <input id="pp-end" type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Live conflict state */}
          {hasConflicts ? (
            <div role="status" className="mt-4 rounded-sm border border-warning/40 bg-warning-tint px-4 py-3">
              <p className="flex items-center gap-2 text-[12px] font-bold text-[#a34d00]">
                <TriangleAlert size={15} strokeWidth={2.2} aria-hidden="true" />
                {t("postponeClashesWith", { title: conflicts[0]?.title ?? t("anotherBooking") })}
              </p>
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-[#a34d00]">
                {t("postponePickSuggested", { range: conflicts[0] ? formatTimeRange(new Date(conflicts[0].starts_at), new Date(conflicts[0].ends_at)) : "" })}
              </p>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s.startsAt}
                      type="button"
                      onClick={() => {
                        const sStart = new Date(s.startsAt);
                        const sEnd = new Date(s.endsAt);
                        setDate(toDateInput(sStart));
                        setStartTime(toTimeInput(sStart));
                        setEndTime(toTimeInput(sEnd));
                      }}
                      className="chip border border-warning/50 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#a34d00] transition-all hover:-translate-y-px"
                    >
                      {relativeDayLabel(new Date(s.startsAt), today)} · {toTimeInput(new Date(s.startsAt))}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            timesValid && (
              <p role="status" className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-success">
                <CheckCircle2 size={15} strokeWidth={2.2} aria-hidden="true" />
                {t("postponeFreeSlot", { range: formatTimeRange(start, end) })}
              </p>
            )
          )}

          {error && (
            <p role="alert" className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-error">
              <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" /> {error}
            </p>
          )}

          {/* Actions */}
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-divider pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary h-11">
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || hasConflicts}
              className="btn btn-primary h-11 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {t("moving")}
                </>
              ) : (
                t("postponeSubmit")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
