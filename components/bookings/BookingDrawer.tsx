"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  DoorOpen,
  GraduationCap,
  Pause,
  Play,
  Send,
  Tag,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import {
  DEMO_CATEGORIES,
  DEMO_CLIENTS,
  DEMO_ROOMS,
} from "@/lib/demo-data";
import { findOverlaps } from "@/lib/conflict";
import { createBookingAction, requestChangeAction, updateBookingAction } from "@/app/actions/bookings";
import {
  suggestSlots,
  type SlotSuggestion,
  type WorkingHoursEntry,
} from "@/lib/slots";
import type { BookingRow, BookingStatus, BookingType } from "@/lib/types/db";
import { useTranslations, useLocale } from "next-intl";
import {
  creatorName,
  formatTime,
  formatTimeRange,
  relativeDayLabel,
  shortRef,
  startOfDay,
} from "@/components/calendar/calendar-utils";
import { useModalA11y } from "./focus-trap";
import { ConflictModal } from "./ConflictModal";
import { appLocaleTag, categoryName } from "@/lib/intl-locale";

/** Default working hours: Mon–Sat 08:00–20:00, Sunday closed. */
const DEFAULT_WH: WorkingHoursEntry[] = [
  { weekday: "mon", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "tue", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "wed", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "thu", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "fri", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "sat", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "sun", is_open: false, open_time: "08:00", close_time: "20:00" },
];

export interface BookingPayload {
  id: string;
  type: BookingType;
  title: string;
  categoryId: string;
  roomId: string | null;
  clientId: string | null;
  startsAt: string;
  endsAt: string;
  price: number | null;
  notes: string | null;
  status: BookingStatus;
}

export interface BookingDrawerProps {
  mode: "create" | "edit" | "view";
  booking?: BookingRow | null;
  /** Pre-fill for create mode (drag-to-create). ISO strings. */
  initial?: { startsAt: string; endsAt: string } | null;
  onClose: () => void;
  /** Pre-fill the client select (deep link from /clients). */
  initialClientId?: string | null;
  onSaved?: (payload: BookingPayload, opts: { conflict: boolean }) => void;
  /** View mode: pause/resume, postpone, remove: same actions as the context menu (needed on touch, where there is no right-click). */
  onTogglePause?: (booking: BookingRow) => void;
  onPostpone?: (booking: BookingRow) => void;
  onRemove?: (booking: BookingRow) => void;
  /** A higher overlay (postpone / remove) is open: swallow Escape so the drawer stays put. */
  blockingOverlay?: boolean;
  /** All active bookings (used by the live conflict preview). */
  bookings?: BookingRow[];
  rooms?: Array<import("@/lib/types/db").RoomRow>;
  categories?: Array<import("@/lib/types/db").CategoryRow>;
  clients?: Array<import("@/lib/types/db").ClientRow>;
  workingHours?: WorkingHoursEntry[];
  live?: boolean;
  /** id → staff display name (for booking authorship rendering). */
  staff?: Record<string, string>;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parseLocal(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() <= 30 ? 30 : 0, 0, 0);
  if (d.getMinutes() === 0) d.setHours(d.getHours() + 1);
  if (d.getHours() >= 19) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

/** Strip the “(DEMO)” suffix for presentation. */
const roomLabel = (name: string) => name.replace(/\s*\(DEMO\)\s*$/, "");

const STATUS_DOT: Record<BookingStatus, string> = {
  confirmed: "bg-success",
  pending_conflict: "bg-warning",
  cancelled: "bg-black/30",
  paused: "bg-warning",
  completed: "bg-obsidian-light",
};
const STATUS_LABEL_KEYS: Record<
  BookingStatus,
  | "statusConfirmed"
  | "statusPendingConflict"
  | "statusCancelled"
  | "statusPaused"
  | "statusCompleted"
> = {
  confirmed: "statusConfirmed",
  pending_conflict: "statusPendingConflict",
  cancelled: "statusCancelled",
  paused: "statusPaused",
  completed: "statusCompleted",
};

export function BookingDrawer({
  mode,
  booking,
  initial,
  onClose,
  onSaved,
  onTogglePause,
  onPostpone,
  onRemove,
  blockingOverlay = false,
  initialClientId = null,
  bookings,
  rooms = DEMO_ROOMS,
  categories = DEMO_CATEGORIES,
  clients = DEMO_CLIENTS,
  workingHours = DEFAULT_WH,
  live = false,
  staff,
}: BookingDrawerProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const intlLocale = appLocaleTag(locale);
  const tCommon = useTranslations("common");
  const existing = bookings ?? [];
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  /* Two-phase close: play the exit (slide/fade) first, then ask the parent to unmount. */
  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setMounted(false);
    window.setTimeout(() => onCloseRef.current(), 320);
  };
  const [view, setView] = useState(mode);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /* Compute starting times once per mount (parent keys the drawer per booking). */
  const [initialTimes] = useState(() => {
    if (booking) {
      return {
        start: new Date(booking.starts_at),
        end: new Date(booking.ends_at),
      };
    }
    if (initial) {
      return { start: new Date(initial.startsAt), end: new Date(initial.endsAt) };
    }
    const start = defaultStart();
    return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
  });

  const [type, setType] = useState<BookingType>(booking?.type ?? "standard");
  const [title, setTitle] = useState(booking?.title ?? "");
  const [categoryId, setCategoryId] = useState(
    booking?.category_id ?? categories[0]?.id ?? "",
  );
  const [roomId, setRoomId] = useState<string>(booking?.room_id ?? rooms[0]?.id ?? "");
  const [clientId, setClientId] = useState<string>(booking?.client_id ?? initialClientId ?? "");
  const [date, setDate] = useState(() => toDateInput(initialTimes.start));
  const [startTime, setStartTime] = useState(() => toTimeInput(initialTimes.start));
  const [endTime, setEndTime] = useState(() => toTimeInput(initialTimes.end));
  const [price, setPrice] = useState(
    booking?.price != null ? String(booking.price) : "",
  );
  const [notes, setNotes] = useState(booking?.notes ?? "");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useModalA11y(panelRef, requestClose, !conflictModalOpen && !blockingOverlay);

  const isView = view === "view";

  /* derived dates + live conflict check */
  const start = parseLocal(date, startTime);
  const end = parseLocal(date, endTime);
  const startMs = start?.getTime() ?? Number.NaN;
  const endMs = end?.getTime() ?? Number.NaN;
  const timesValid =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;

  const conflicts = useMemo(() => {
    if (!timesValid || !roomId || !start || !end) return [];
    // Exclude self on edit; active bookings only (findOverlaps does that).
    return findOverlaps(roomId, start, end, existing, booking?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, startMs, endMs, booking?.id]);

  const suggestions = useMemo<SlotSuggestion[]>(() => {
    if (!timesValid || !roomId || !start || !end) return [];
    const durationMin = Math.round((endMs - startMs) / 60000);
    if (durationMin <= 0) return [];
    const sameRoom = existing.filter((b) => b.room_id === roomId);
    return suggestSlots({
      roomId,
      desiredStart: start,
      durationMin,
      incrementMin: 30,
      bufferMin: 0,
      daysAhead: 7,
      limit: 4,
      existing: sameRoom,
      workingHours,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, startMs, endMs]);

  const hasConflicts = conflicts.length > 0;
  const today = startOfDay(new Date());
  const suggestionChips = suggestions.map((s) => {
    const sStart = new Date(s.startsAt);
    return {
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      label: `${relativeDayLabel(sStart, today, { today: t("today"), tomorrow: t("tomorrow") })} · ${formatTime(sStart, intlLocale)}`,
    };
  });
  const staffName = (id: string | null | undefined) => (id && staff?.[id]) || undefined;
  const clashItems = conflicts.map((c) => ({
    id: c.id,
    title: c.title ?? t("existingBooking"),
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    requestedBy: staffName(c.created_by) ?? creatorName(c.created_by, t("unknown")),
  }));

  const selectedRoom = roomId ? rooms.find((r) => r.id === roomId) : null;
  const selectedRoomName = selectedRoom ? roomLabel(selectedRoom.name) : t("noRoomOffSite");
  const selectedClient = clientId
    ? clients.find((c) => c.id === clientId)
    : null;
  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : null;
  const canSubmit = title.trim().length >= 2 && timesValid;
  const submitLabel = hasConflicts ? t("sendChangeRequest") : t("saveBooking");
  const incumbentName = clashItems[0]?.requestedBy ?? t("theIncumbent");

  const applySuggestion = (s: { startsAt: string; endsAt: string }) => {
    const sStart = new Date(s.startsAt);
    const sEnd = new Date(s.endsAt);
    setDate(toDateInput(sStart));
    setStartTime(toTimeInput(sStart));
    setEndTime(toTimeInput(sEnd));
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!canSubmit || !start || !end) return;

    const payload = {
      type,
      title: title.trim(),
      categoryId,
      roomId: roomId || null,
      clientId: clientId || null,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      price: price.trim() === "" ? null : Number(price),
      notes: notes.trim() === "" ? null : notes.trim(),
    };
    setSaving(true);
    try {
      if (hasConflicts) {
        const res = await requestChangeAction({
          ...payload,
          conflictingBookingId: conflicts[0].id,
          existingBookingId: booking?.id,
          message: notes.trim() || undefined,
        });
        if (!res.ok) { setError(res.error.message); return; }
        onSaved?.(
          { ...payload, id: res.data.bookingId, status: "pending_conflict" },
          { conflict: true },
        );
        requestClose();
        return;
      }
      let res;
      if (view === "edit" && booking) {
        res = await updateBookingAction({ bookingId: booking.id, ...payload });
      } else {
        res = await createBookingAction(payload);
      }
      if (!res.ok) { setError(res.error.message); return; }
      if ("conflict" in res.data) {
        // Race lost between preview and submit: server wins; show its conflicts.
        setError(t("slotTakenError"));
        return;
      }
      onSaved?.({ ...payload, id: res.data.bookingId, status: booking?.status === "completed" ? "completed" : "confirmed" }, { conflict: false });
      requestClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setSaving(false);
    }
  };

  const statusKey = STATUS_LABEL_KEYS[booking?.status ?? "confirmed"];
  const statusMeta = { label: t(statusKey), dot: STATUS_DOT[booking?.status ?? "confirmed"] };
  const heading =
    view === "view" ? t("headingBookingDetails") : view === "edit" ? t("headingEditBooking") : t("newBooking");
  const kicker =
    view === "view" ? (live ? t("kickerLive") : t("offlinePreview")) : view === "edit" ? (live ? t("kickerLiveEdit") : t("kickerOfflineEdit")) : live ? t("kickerCreateLive") : t("kickerCreateOffline");

  return (
    <div className={`fixed inset-0 z-50 ${closing ? "pointer-events-none" : ""}`} aria-hidden={closing || undefined}>
      {/* Overlay: click closes */}
      <button
        type="button"
        aria-label={t("closePanel")}
        tabIndex={-1}
        onClick={requestClose}
        className={`absolute inset-0 cursor-default bg-obsidian/30 backdrop-blur-[2px] transition-opacity duration-slow ease-apple ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel: right drawer (full-screen on mobile) */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-lg transition-transform duration-slower ease-apple sm:max-w-[460px] sm:border-l sm:border-border ${
          mounted ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-divider px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
              {kicker}
            </p>
            <h2 title={heading} className="truncate text-[17px] font-extrabold tracking-[-0.02em] text-obsidian">
              {heading}
            </h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label={tCommon("close")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-black/[0.04] hover:text-obsidian"
          >
            <X size={19} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        {isView ? (
          <ViewBody
            booking={booking}
            statusMeta={statusMeta}
            selectedRoomName={selectedRoomName}
            roomLocation={selectedRoom?.location}
            clientName={selectedClient?.full_name ?? null}
            categoryName={categoryName(selectedCategory, locale) || "—"}
            staff={staff}
          />
        ) : (
          <form
            id="booking-form"
            onSubmit={handleSubmit}
            className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
            noValidate
          >
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="bk-title" className="label">
                  {t("titleLabel")}
                </label>
                <input
                  id="bk-title"
                  autoFocus
                  className="input"
                  placeholder={t("titlePlaceholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={submitted && title.trim().length < 2}
                />
              </div>

              {/* Type + category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bk-type" className="label">
                    {t("typeLabel")}
                  </label>
                  <select
                    id="bk-type"
                    className="input"
                    value={type}
                    onChange={(e) => {
                      const next = e.target.value as BookingType;
                      setType(next);
                      // Keep system category in sync with the booking type.
                      setCategoryId((prev) =>
                        prev === "cat-formation" || prev === "cat-room-rental"
                          ? next === "formation"
                            ? "cat-formation"
                            : "cat-room-rental"
                          : prev,
                      );
                    }}
                  >
                    <option value="standard">{t("typeStandard")}</option>
                    <option value="formation">{t("typeFormation")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="bk-category" className="label">
                    {t("categoryLabel")}
                  </label>
                  <select
                    id="bk-category"
                    className="input"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {categoryName(c, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Room + client */}
              <div>
                <label htmlFor="bk-room" className="label">
                  {t("roomLabel")}
                </label>
                <select
                  id="bk-room"
                  className="input"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  <option value="">{t("noRoomOffSite")}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {roomLabel(r.name)} · {r.location} · {r.capacity}p
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bk-client" className="label">
                  {t("clientLabel")}
                </label>
                <select
                  id="bk-client"
                  className="input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">{t("noClient")}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date + time */}
              <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-3">
                <div>
                  <label htmlFor="bk-date" className="label">
                    {t("dateLabel")}
                  </label>
                  <input
                    id="bk-date"
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="bk-start" className="label">
                    {t("startLabel")}
                  </label>
                  <input
                    id="bk-start"
                    type="time"
                    step={900}
                    className="input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="bk-end" className="label">
                    {t("endLabel")}
                  </label>
                  <input
                    id="bk-end"
                    type="time"
                    step={900}
                    className="input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    aria-invalid={submitted && !timesValid}
                  />
                </div>
              </div>

              {/* Price */}
              <div>
                <label htmlFor="bk-price" className="label">
                  {t("priceOptionalLabel")}
                </label>
                <input
                  id="bk-price"
                  type="number"
                  min={0}
                  step={50}
                  inputMode="numeric"
                  className="input"
                  placeholder={t("pricePlaceholder")}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="bk-notes" className="label">
                  {t("notesLabel")}
                </label>
                <textarea
                  id="bk-notes"
                  className="input min-h-[76px] resize-y py-3"
                  rows={3}
                  placeholder={t("notesPlaceholder")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Validation error */}
              {submitted && !canSubmit && (
                <p role="alert" className="text-[13px] font-semibold text-error-fg">
                  {t("validationError")}
                </p>
              )}

              {/* Live conflict banner */}
              {hasConflicts ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-sm border border-warning/50 bg-warning-tint p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <TriangleAlert
                      size={18}
                      strokeWidth={2.2}
                      className="mt-0.5 shrink-0 text-tint-fg-amber"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      {conflicts.slice(0, 2).map((c) => (
                        <p
                          key={c.id}
                          className="text-[13px] font-bold leading-snug text-tint-fg-amber"
                        >
                          {t("conflictRoomBooked", {
                            room: selectedRoomName,
                            timeRange: formatTimeRange(new Date(c.starts_at), new Date(c.ends_at), intlLocale),
                            title: c.title ?? t("existingBooking"),
                          })}
                        </p>
                      ))}
                      {conflicts.length > 2 && (
                        <p className="mt-0.5 text-[12px] font-semibold text-tint-fg-amber">
                          {t("plusConflicts", { count: conflicts.length - 2 })}
                        </p>
                      )}
                      <p className="mt-1 text-[12px] leading-snug text-obsidian-light">
                        {t("conflictAskMove", { incumbent: incumbentName })}
                      </p>
                    </div>
                  </div>

                  {/* Suggested slots */}
                  {suggestionChips.length > 0 && (
                    <div className="mt-2.5 pl-[30px]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-tint-fg-amber">
                        {t("suggestedSlots")}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {suggestionChips.map((s) => (
                          <button
                            key={s.startsAt}
                            type="button"
                            onClick={() => applySuggestion(s)}
                            title={formatTimeRange(new Date(s.startsAt), new Date(s.endsAt), intlLocale)}
                            className="chip border border-warning/50 bg-white/70 text-[11px] text-tint-fg-amber transition-all hover:-translate-y-px hover:bg-white"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 pl-[30px]">
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-warning px-4 text-[12px] font-bold text-obsidian transition-all hover:brightness-95"
                    >
                      <Send size={13} strokeWidth={2.4} aria-hidden="true" />
                      {t("requestChangeFrom", { incumbent: incumbentName })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConflictModalOpen(true)}
                      className="inline-flex h-9 items-center gap-0.5 rounded-pill px-3 text-[12px] font-bold text-tint-fg-amber transition-colors hover:bg-warning/20"
                    >
                      {t("reviewConflicts")}
                      <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                timesValid &&
                roomId && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-tint-fg-green"
                  >
                    <CheckCircle2 size={15} strokeWidth={2.2} aria-hidden="true" />
                    {t("slotFree", { room: selectedRoomName, timeRange: start ? formatTimeRange(start, end!, intlLocale) : "" })}
                  </p>
                )
              )}
            </div>
          </form>
        )}

        {/* Error surface */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mx-5 mb-2 flex items-start gap-2.5 rounded-sm border border-error/25 bg-error-tint px-4 py-3 text-[13px] font-medium leading-snug text-error-fg"
          >
            <TriangleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* View mode: quick actions (touch-friendly: no right-click needed) */}
        {isView && booking && (onTogglePause || onPostpone || onRemove) && (
          <div className="flex shrink-0 items-center gap-1.5 border-t border-divider px-5 py-2.5" aria-label="Quick actions">
            {onTogglePause && (
              <button
                type="button"
                onClick={() => onTogglePause(booking)}
                className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-[12px] font-bold text-obsidian-light transition-colors hover:bg-hover-fill hover:text-obsidian"
              >
                {booking.status === "paused" ? <Play size={13} strokeWidth={2.2} aria-hidden="true" /> : <Pause size={13} strokeWidth={2.2} aria-hidden="true" />}
                {booking.status === "paused" ? tCommon("contextMenuResume") : tCommon("contextMenuPause")}
              </button>
            )}
            {onPostpone && (
              <button
                type="button"
                onClick={() => onPostpone(booking)}
                className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-[12px] font-bold text-obsidian-light transition-colors hover:bg-hover-fill hover:text-obsidian"
              >
                <CalendarClock size={13} strokeWidth={2.2} aria-hidden="true" />
                {tCommon("contextMenuPostpone")}
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(booking)}
                className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-[12px] font-bold text-error-fg transition-colors hover:bg-error-tint"
              >
                <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
                {tCommon("remove")}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-divider px-5 py-4">
          {isView ? (
            <>
              <button type="button" onClick={requestClose} className="btn btn-secondary">
                {tCommon("close")}
              </button>
              <button
                type="button"
                onClick={() => setView("edit")}
                className="btn btn-primary"
              >
                {t("headingEditBooking")}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={requestClose} className="btn btn-secondary">
                {tCommon("cancel")}
              </button>
              <button
                type="submit"
                form="booking-form"
                disabled={saving}
                className={`btn disabled:cursor-wait disabled:opacity-75 ${hasConflicts ? "bg-warning text-obsidian hover:brightness-95" : "btn-primary"}`}
              >
                {hasConflicts && (
                  <Send size={16} strokeWidth={2.4} aria-hidden="true" />
                )}
                {saving ? t("saving") : submitLabel}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Full-screen conflict treatment */}
      {conflictModalOpen && (
        <ConflictModal
          roomName={selectedRoomName}
          conflicts={clashItems}
          suggestions={suggestionChips}
          onClose={() => setConflictModalOpen(false)}
          onPickSuggestion={(s) => {
            applySuggestion(s);
            setConflictModalOpen(false);
          }}
          onRequestChange={() => {
            setConflictModalOpen(false);
            handleSubmit();
          }}
        />
      )}
    </div>
  );
}

/* view mode body */

function ViewBody({
  booking,
  statusMeta,
  selectedRoomName,
  roomLocation,
  clientName,
  categoryName,
  staff,
}: {
  booking?: BookingRow | null;
  statusMeta: { label: string; dot: string };
  selectedRoomName: string;
  roomLocation?: string;
  clientName: string | null;
  categoryName: string;
  staff?: Record<string, string>;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const intlLocale = appLocaleTag(locale);
  if (!booking) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <p className="text-[14px] text-obsidian-light">{t("noBookingSelected")}</p>
      </div>
    );
  }
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const isFormation = booking.type === "formation";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      {/* Summary card */}
      <div className="rounded-md border border-border bg-canvas/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white px-2.5 py-1 text-[11px] font-bold text-obsidian-light ring-1 ring-border">
            {isFormation ? (
              <GraduationCap size={13} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <DoorOpen size={13} strokeWidth={2.2} aria-hidden="true" />
            )}
            {isFormation ? t("typeFormation") : t("typeStandard")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white px-2.5 py-1 text-[11px] font-bold text-obsidian ring-1 ring-border">
            <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} aria-hidden="true" />
            {statusMeta.label}
          </span>
        </div>
        <h3 className="mt-3 text-[18px] font-extrabold leading-snug tracking-[-0.02em] text-obsidian">
          {booking.title}
        </h3>
        <p className="mt-1 text-[12px] font-medium text-muted">
          {t("createdByLine", { name: (booking.created_by && staff?.[booking.created_by]) || creatorName(booking.created_by, t("unknown")), ref: shortRef(booking.id) })}
        </p>
      </div>

      {/* Fact rows */}
      <dl className="mt-5 divide-y divide-divider rounded-md border border-border bg-white">
        <FactRow icon={DoorOpen} label={t("roomLabel")}>
          {selectedRoomName}
          {roomLocation ? (
            <span className="text-muted"> · {roomLocation}</span>
          ) : null}
        </FactRow>
        <FactRow icon={Clock} label={t("dateTimeFactLabel")}>
          {start.toLocaleDateString(intlLocale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · {formatTimeRange(start, end, intlLocale)}
        </FactRow>
        <FactRow icon={Users} label={t("clientLabel")}>
          {clientName ?? t("noClient")}
        </FactRow>
        <FactRow icon={Tag} label={t("categoryLabel")}>
          {categoryName}
        </FactRow>
        <FactRow icon={Banknote} label={t("priceFactLabel")}>
          {booking.price != null ? `${booking.price}\u00A0MAD` : "—"}
        </FactRow>
      </dl>

      {booking.notes && (
        <div className="mt-4 rounded-sm border border-border border-l-2 border-l-electric bg-white p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            {t("notesLabel")}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-obsidian-light">
            {booking.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function FactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof DoorOpen;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon
        size={17}
        strokeWidth={2}
        className="mt-0.5 shrink-0 text-muted"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          {label}
        </dt>
        <dd className="mt-0.5 text-[13px] font-medium leading-snug text-obsidian">
          {children}
        </dd>
      </div>
    </div>
  );
}
