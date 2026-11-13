"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import type { BookingRow } from "@/lib/types/db";
import type { CalendarData } from "@/lib/live-data";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  buildLookup,
  rangeLabel,
  startOfDay,
  startOfWeekMonday,
  type CalendarView,
} from "./calendar-utils";
import { TimeGrid } from "./TimeGrid";
import { MonthView } from "./MonthView";
import { AgendaView, DayTimeline } from "./agenda";
import {
  BookingDrawer,
  type BookingPayload,
} from "@/components/bookings/BookingDrawer";
import { Toast, type ToastData } from "@/components/bookings/Toast";

const VIEWS: Array<{ id: CalendarView; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];

interface DrawerState {
  mode: "create" | "edit" | "view";
  booking?: BookingRow | null;
  initial?: { startsAt: string; endsAt: string } | null;
  clientId?: string | null;
  key: number;
}

export function CalendarClient({ serverNow, data, prefillClientId = null }: { serverNow: string; data: CalendarData; prefillClientId?: string | null }) {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date(serverNow)), [serverNow]);
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(today);
  const [bookings, setBookings] = useState<BookingRow[]>(() => data.bookings);
  const [query, setQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<"all" | "Casablanca" | "Agadir">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  // Deep link: /calendar?client=<id> — open the create drawer prefilled.
  useEffect(() => {
    if (!prefillClientId) return;
    setDrawer({ mode: "create", key: Date.now(), clientId: prefillClientId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillClientId]);
  const [toast, setToast] = useState<ToastData | null>(null);

  const lookup = useMemo(
    () => buildLookup(data.rooms, data.categories, data.clients),
    [data.rooms, data.categories, data.clients],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (roomFilter !== "all" && b.room_id !== roomFilter) return false;
      if (categoryFilter !== "all" && b.category_id !== categoryFilter) return false;
      if (locationFilter !== "all") {
        const room = b.room_id ? lookup.roomById.get(b.room_id) : null;
        if (room?.location !== locationFilter) return false;
      }
      if (q) {
        const room = b.room_id ? (lookup.roomById.get(b.room_id)?.name ?? "") : "";
        const client = b.client_id ? (lookup.clientById.get(b.client_id)?.full_name ?? "") : "";
        const cat = lookup.categoryById.get(b.category_id)?.name_en ?? "";
        const hay = `${b.title} ${room} ${client} ${cat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, query, roomFilter, categoryFilter, locationFilter, lookup]);

  const pendingConflicts = useMemo(
    () => bookings.filter((b) => b.status === "pending_conflict"),
    [bookings],
  );

  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const stepLabel =
    view === "month"
      ? "month"
      : view === "week"
        ? "week"
        : view === "agenda"
          ? "14 days"
          : "day";

  const step = (dir: 1 | -1) => {
    if (view === "week") setAnchor((d) => addDays(d, dir * 7));
    else if (view === "day") setAnchor((d) => addDays(d, dir));
    else if (view === "agenda") setAnchor((d) => addDays(d, dir * 14));
    else setAnchor((d) => addMonths(d, dir));
  };

  const openCreate = useCallback((initial?: { startsAt: string; endsAt: string }) => {
    setDrawer({ mode: "create", initial: initial ?? null, key: Date.now() });
  }, []);

  const openForRange = useCallback((_day: Date, startsAt: Date, endsAt: Date) => {
    setDrawer({
      mode: "create",
      initial: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
      key: Date.now(),
    });
  }, []);

  const openView = useCallback((booking: BookingRow) => {
    setDrawer({ mode: "view", booking, key: Date.now() });
  }, []);

  const handleSaved = useCallback(
    (payload: BookingPayload, opts: { conflict: boolean }) => {
      setBookings((prev) => {
        const row: BookingRow = {
          id: payload.id,
          type: payload.type,
          title: payload.title,
          category_id: payload.categoryId,
          room_id: payload.roomId,
          client_id: payload.clientId,
          created_by: "demo-admin",
          starts_at: payload.startsAt,
          ends_at: payload.endsAt,
          status: payload.status,
          price: payload.price,
          notes: payload.notes,
        };
        const exists = prev.some((b) => b.id === row.id);
        return exists
          ? prev.map((b) => (b.id === row.id ? row : b))
          : [...prev, row];
      });
      router.refresh(); // re-fetch server data (live mode)
      setToast({
        id: Date.now(),
        tone: opts.conflict ? "warning" : "success",
        title: opts.conflict
          ? "Change request sent to the incumbent"
          : "Booking saved",
        detail: opts.conflict
          ? "The incumbent has 72h to approve the move."
          : payload.title,
      });
    },
    [router],
  );

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && query) {
      e.stopPropagation();
      setQuery("");
    }
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.04em] text-obsidian sm:text-[32px]">
            Calendar
          </h1>
          <p className="mt-1 text-[14px] font-medium text-obsidian-light">
            Bookings, formations and rooms — double-booking guarded
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!data.live && (
            <span className="chip border border-warning/50 bg-warning-tint text-[11px] font-bold text-[#a34d00]">
              Offline preview
            </span>
          )}
          {pendingConflicts.length > 0 && (
            <button
              type="button"
              onClick={() => openView(pendingConflicts[0])}
              className="chip border border-dashed border-warning/70 bg-warning-tint !px-3 !py-1.5 text-[12px] font-bold text-[#a34d00] transition-all hover:-translate-y-px"
            >
              <TriangleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
              {pendingConflicts.length} pending conflict{pendingConflicts.length > 1 ? "s" : ""}
            </button>
          )}
          <button type="button" onClick={() => openCreate()} className="btn btn-primary">
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            New booking
          </button>
        </div>
      </div>

      {/* Controls: search + filters + view switch */}
      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <label className="relative block w-full max-w-md">
          <Search
            size={17}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-black/35"
          />
          <span className="sr-only">Search bookings</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search bookings, rooms, clients…"
            aria-label="Search bookings, rooms, clients"
            className="h-11 w-full rounded-pill border border-border bg-white pl-11 pr-10 text-[14px] text-obsidian outline-none transition-shadow placeholder:text-black/30 focus:border-electric/40 focus:shadow-[0_0_0_4px_var(--color-electric-tint)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill text-muted transition-colors hover:bg-black/[0.04] hover:text-obsidian"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Filter by room"
            value={roomFilter}
            onChange={setRoomFilter}
            options={[
              { value: "all", label: "All rooms" },
              ...data.rooms.map((r) => ({
                value: r.id,
                label: `${r.name.replace(/\s*\(DEMO\)\s*$/, "")} · ${r.location}`,
              })),
            ]}
          />
          <FilterSelect
            label="Filter by location"
            value={locationFilter}
            onChange={(v) => setLocationFilter(v as "all" | "Casablanca" | "Agadir")}
            options={[
              { value: "all", label: "All locations" },
              { value: "Casablanca", label: "Casablanca" },
              { value: "Agadir", label: "Agadir" },
            ]}
          />
          <FilterSelect
            label="Filter by category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: "all", label: "All categories" },
              ...data.categories.map((c) => ({ value: c.id, label: c.name_en })),
            ]}
          />

          <div className="segmented" role="group" aria-label="Calendar view">
            {VIEWS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`segment ${view === id ? "segment-active" : ""}`}
              >
                {id === "agenda" ? (
                  <List size={14} strokeWidth={2.2} className="mr-1.5" aria-hidden="true" />
                ) : (
                  <CalendarDays size={14} strokeWidth={2.2} className="mr-1.5 hidden sm:inline" aria-hidden="true" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation row */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-pill border border-border bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={`Previous ${stepLabel}`}
            className="flex h-9 w-9 items-center justify-center rounded-pill text-obsidian-light transition-colors hover:bg-black/[0.04] hover:text-obsidian"
          >
            <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(today)}
            className="h-9 rounded-pill px-4 text-[13px] font-bold text-obsidian transition-colors hover:bg-electric-tint hover:text-electric"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={`Next ${stepLabel}`}
            className="flex h-9 w-9 items-center justify-center rounded-pill text-obsidian-light transition-colors hover:bg-black/[0.04] hover:text-obsidian"
          >
            <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <h2
          className="text-[15px] font-extrabold tracking-[-0.02em] text-obsidian sm:text-[17px]"
          aria-live="polite"
        >
          {rangeLabel(view, anchor)}
        </h2>

        {/* Legend */}
        <div
          className="ml-auto hidden items-center gap-3 text-[10px] font-semibold text-muted lg:flex"
          aria-hidden="true"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-tint-blue ring-1 ring-electric/30" /> Room
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-tint-green ring-1 ring-[#248a3d]/30" /> Formation
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-tint-purple ring-1 ring-[#5e5ce6]/30" /> Event
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px] border border-dashed border-warning bg-warning-tint" /> Pending
          </span>
        </div>
      </div>

      {/* Views */}
      <div className="mt-4">
        {view === "week" && (
          <TimeGrid
            days={weekDays}
            bookings={filtered}
            lookup={lookup}
            serverNow={serverNow}
            onBookingClick={openView}
            onCreateRange={openForRange}
          />
        )}
        {view === "day" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <TimeGrid
              days={[anchor]}
              bookings={filtered}
              lookup={lookup}
              serverNow={serverNow}
              onBookingClick={openView}
              onCreateRange={openForRange}
            />
            <DayTimeline
              day={anchor}
              bookings={filtered}
              lookup={lookup}
              onBookingClick={openView}
            />
          </div>
        )}
        {view === "month" && (
          <MonthView
            anchor={anchor}
            today={today}
            bookings={filtered}
            lookup={lookup}
            onSelectDay={(d) => {
              setAnchor(d);
              setView("day");
            }}
            onBookingClick={openView}
          />
        )}
        {view === "agenda" && (
          <AgendaView
            today={today}
            windowStart={anchor}
            bookings={filtered}
            lookup={lookup}
            onBookingClick={openView}
          />
        )}
      </div>

      <p className="mt-4 text-[11px] font-medium text-muted">
        Drag on empty grid cells to create a booking · double-booking is blocked at save time and enforced by database trigger.
      </p>

      {/* Drawer */}
      {drawer && (
        <BookingDrawer
          key={drawer.key}
          mode={drawer.mode}
          booking={drawer.booking}
          initial={drawer.initial}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
          initialClientId={drawer.clientId ?? null}
          bookings={bookings}
          rooms={data.rooms}
          categories={data.categories}
          clients={data.clients}
          workingHours={data.workingHours}
          live={data.live}
        />
      )}

      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

/* ---------------- filter select (native, styled) ---------------- */

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={`filter-${label}`}>
        {label}
      </label>
      <select
        id={`filter-${label}`}
        value={value}
        onChange={(e: FormEvent<HTMLSelectElement>) => onChange(e.currentTarget.value)}
        aria-label={label}
        className="h-11 appearance-none rounded-pill border border-border bg-white pl-4 pr-9 text-[13px] font-semibold text-obsidian outline-none transition-shadow focus:border-electric/40 focus:shadow-[0_0_0_4px_var(--color-electric-tint)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={2.4}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
