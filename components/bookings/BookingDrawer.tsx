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
  CheckCircle2,
  ChevronRight,
  Clock,
  DoorOpen,
  GraduationCap,
  Send,
  Tag,
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
import { createBookingAction, requestChangeAction } from "@/app/actions/bookings";
import {
  suggestSlots,
  type SlotSuggestion,
  type WorkingHoursEntry,
} from "@/lib/slots";
import type { BookingRow, BookingStatus, BookingType } from "@/lib/types/db";
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

/** Default working hours — Mon–Sat 08:00–20:00, Sunday closed. */
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
  onSaved?: (payload: BookingPayload, opts: { conflict: boolean }) => void;
  /** All active bookings (used by the live conflict preview). */
  bookings?: BookingRow[];
  rooms?: Array<import("@/lib/types/db").RoomRow>;
  categories?: Array<import("@/lib/types/db").CategoryRow>;
  clients?: Array<import("@/lib/types/db").ClientRow>;
  workingHours?: WorkingHoursEntry[];
  live?: boolean;
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

const STATUS_META: Record<BookingStatus, { label: string; dot: string }> = {
  confirmed: { label: "Confirmed", dot: "bg-success" },
  pending_conflict: { label: "Pending conflict", dot: "bg-warning" },
  cancelled: { label: "Cancelled", dot: "bg-black/30" },
  completed: { label: "Completed", dot: "bg-obsidian-light" },
};

export function BookingDrawer({
  mode,
  booking,
  initial,
  onClose,
  onSaved,
  bookings,
  rooms = DEMO_ROOMS,
  categories = DEMO_CATEGORIES,
  clients = DEMO_CLIENTS,
  workingHours = DEFAULT_WH,
  live = false,
}: BookingDrawerProps) {
  const existing = bookings ?? [];
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const localIdRef = useRef(0);
  const [mounted, setMounted] = useState(false);
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
  const [clientId, setClientId] = useState<string>(booking?.client_id ?? "");
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

  useModalA11y(panelRef, onClose, !conflictModalOpen);

  const isView = view === "view";

  /* ---------- derived dates + live conflict check ---------- */
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
      label: `${relativeDayLabel(sStart, today)} · ${formatTime(sStart)}`,
    };
  });
  const clashItems = conflicts.map((c) => ({
    id: c.id,
    title: c.title ?? "Existing booking",
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    requestedBy: creatorName(c.created_by),
  }));

  const selectedRoom = roomId ? rooms.find((r) => r.id === roomId) : null;
  const selectedRoomName = selectedRoom ? roomLabel(selectedRoom.name) : "No room / off-site";
  const selectedClient = clientId
    ? clients.find((c) => c.id === clientId)
    : null;
  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : null;

  const canSubmit = title.trim().length >= 2 && timesValid;
  const submitLabel = hasConflicts ? "Send change request" : "Save booking";
  const incumbentName = clashItems[0]?.requestedBy ?? "the incumbent";

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
        const res = await requestChangeAction({ ...payload, conflictingBookingId: conflicts[0].id, message: notes.trim() || undefined });
        if (!res.ok) { setError(res.error.message); return; }
        onSaved?.(
          { ...payload, id: res.data.bookingId, status: "pending_conflict" },
          { conflict: true },
        );
        onClose();
        return;
      }
      const res = await createBookingAction(payload);
      if (!res.ok) { setError(res.error.message); return; }
      if (res.data.conflict) {
        // Race lost between preview and submit — server wins; show its conflicts.
        setError("That slot was just taken — pick a suggested time.");
        return;
      }
      onSaved?.({ ...payload, id: res.data.bookingId, status: "confirmed" }, { conflict: false });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  };

  const statusMeta = STATUS_META[booking?.status ?? "confirmed"];
  const heading =
    view === "view" ? "Booking details" : view === "edit" ? "Edit booking" : "New booking";
  const kicker =
    view === "view" ? (live ? "Live" : "Offline preview") : view === "edit" ? (live ? "Live · edit" : "Offline preview · edit") : live ? "Create · live" : "Create · offline preview";

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay — click closes */}
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-obsidian/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel — right drawer (full-screen on mobile) */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-lg transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] sm:max-w-[460px] sm:border-l sm:border-border ${
          mounted ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-divider px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              {kicker}
            </p>
            <h2 className="truncate text-[17px] font-extrabold tracking-[-0.02em] text-obsidian">
              {heading}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
            categoryName={selectedCategory?.name_en ?? "—"}
          />
        ) : (
          <form
            id="booking-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-5 py-5"
            noValidate
          >
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="bk-title" className="label">
                  Title
                </label>
                <input
                  id="bk-title"
                  autoFocus
                  className="input"
                  placeholder="e.g. ONCF — Steering committee"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={submitted && title.trim().length < 2}
                />
              </div>

              {/* Type + category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bk-type" className="label">
                    Type
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
                    <option value="standard">Standard</option>
                    <option value="formation">Formation</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="bk-category" className="label">
                    Category
                  </label>
                  <select
                    id="bk-category"
                    className="input"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Room + client */}
              <div>
                <label htmlFor="bk-room" className="label">
                  Room
                </label>
                <select
                  id="bk-room"
                  className="input"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  <option value="">No room / off-site</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {roomLabel(r.name)} · {r.location} · {r.capacity}p
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bk-client" className="label">
                  Client
                </label>
                <select
                  id="bk-client"
                  className="input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">No client</option>
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
                    Date
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
                    Start
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
                    End
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
                  Price (MAD, optional — informational)
                </label>
                <input
                  id="bk-price"
                  type="number"
                  min={0}
                  step={50}
                  inputMode="numeric"
                  className="input"
                  placeholder="e.g. 675"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="bk-notes" className="label">
                  Notes
                </label>
                <textarea
                  id="bk-notes"
                  className="input min-h-[76px] resize-y py-3"
                  rows={3}
                  placeholder="Anything the team should know…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Validation error */}
              {submitted && !canSubmit && (
                <p role="alert" className="text-[13px] font-semibold text-error">
                  Please add a title and make sure the end time is after the start time.
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
                      className="mt-0.5 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      {conflicts.slice(0, 2).map((c) => (
                        <p
                          key={c.id}
                          className="text-[13px] font-bold leading-snug text-[#a34d00]"
                        >
                          {selectedRoomName} is booked{" "}
                          {formatTimeRange(new Date(c.starts_at), new Date(c.ends_at))}{" "}
                          — {c.title}
                        </p>
                      ))}
                      {conflicts.length > 2 && (
                        <p className="mt-0.5 text-[12px] font-semibold text-[#a34d00]">
                          +{conflicts.length - 2} more overlapping booking
                          {conflicts.length - 2 > 1 ? "s" : ""}
                        </p>
                      )}
                      <p className="mt-1 text-[12px] leading-snug text-obsidian-light">
                        Pick another slot, or ask {incumbentName} to move their booking —
                        we’ll send a change request instead of double-booking the room.
                      </p>
                    </div>
                  </div>

                  {/* Suggested slots */}
                  {suggestionChips.length > 0 && (
                    <div className="mt-2.5 pl-[30px]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#a34d00]">
                        Suggested slots
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {suggestionChips.map((s) => (
                          <button
                            key={s.startsAt}
                            type="button"
                            onClick={() => applySuggestion(s)}
                            title={formatTimeRange(new Date(s.startsAt), new Date(s.endsAt))}
                            className="chip border border-warning/50 bg-white/70 text-[11px] text-[#a34d00] transition-all hover:-translate-y-px hover:bg-white"
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
                      Request change from {incumbentName}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConflictModalOpen(true)}
                      className="inline-flex h-9 items-center gap-0.5 rounded-pill px-3 text-[12px] font-bold text-[#a34d00] transition-colors hover:bg-warning/20"
                    >
                      Review conflicts
                      <ChevronRight size={14} strokeWidth={2.6} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                timesValid &&
                roomId && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-success"
                  >
                    <CheckCircle2 size={15} strokeWidth={2.2} aria-hidden="true" />
                    Slot is free — {selectedRoomName} · {start ? formatTimeRange(start, end!) : ""}
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
            className="mx-5 mb-2 flex items-start gap-2.5 rounded-sm border border-error/25 bg-error-tint px-4 py-3 text-[13px] font-medium leading-snug text-[#c22a22]"
          >
            <TriangleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-divider px-5 py-4">
          {isView ? (
            <>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Close
              </button>
              <button
                type="button"
                onClick={() => setView("edit")}
                className="btn btn-primary"
              >
                Edit booking
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
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
                {saving ? "Saving…" : submitLabel}
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

/* ---------------- view mode body ---------------- */

function ViewBody({
  booking,
  statusMeta,
  selectedRoomName,
  roomLocation,
  clientName,
  categoryName,
}: {
  booking?: BookingRow | null;
  statusMeta: { label: string; dot: string };
  selectedRoomName: string;
  roomLocation?: string;
  clientName: string | null;
  categoryName: string;
}) {
  if (!booking) {
    return (
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <p className="text-[14px] text-obsidian-light">No booking selected.</p>
      </div>
    );
  }
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const isFormation = booking.type === "formation";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      {/* Summary card */}
      <div className="rounded-md border border-border bg-canvas/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white px-2.5 py-1 text-[11px] font-bold text-obsidian-light ring-1 ring-border">
            {isFormation ? (
              <GraduationCap size={13} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <DoorOpen size={13} strokeWidth={2.2} aria-hidden="true" />
            )}
            {isFormation ? "Formation" : "Standard"}
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
          Created by {creatorName(booking.created_by)} · Ref #{shortRef(booking.id)}
        </p>
      </div>

      {/* Fact rows */}
      <dl className="mt-5 divide-y divide-divider rounded-md border border-border bg-white">
        <FactRow icon={DoorOpen} label="Room">
          {selectedRoomName}
          {roomLocation ? (
            <span className="text-muted"> · {roomLocation}</span>
          ) : null}
        </FactRow>
        <FactRow icon={Clock} label="Date & time">
          {start.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · {formatTimeRange(start, end)}
        </FactRow>
        <FactRow icon={Users} label="Client">
          {clientName ?? "No client"}
        </FactRow>
        <FactRow icon={Tag} label="Category">
          {categoryName}
        </FactRow>
        <FactRow icon={Banknote} label="Price">
          {booking.price != null ? `${booking.price} MAD` : "—"}
        </FactRow>
      </dl>

      {booking.notes && (
        <div className="mt-4 rounded-sm border border-border border-l-2 border-l-electric bg-white p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
            Notes
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
        <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
          {label}
        </dt>
        <dd className="mt-0.5 text-[13px] font-medium leading-snug text-obsidian">
          {children}
        </dd>
      </div>
    </div>
  );
}
