/**
 * Formations list — client component.
 * Demo data (getDemoBookings + DEMO_FORMATIONS) + local state.
 * Live mode: VMs come from the server (Supabase) via loadFormations().
 * Demo mode: local sessionStorage fallback.
 */

"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Plus, Search } from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";
import { DEMO_ROOMS } from "@/lib/demo-data";
import type { FormationListData } from "@/lib/formation-vms";
import { createFormationAction } from "@/app/actions/formations";
import type { BookingRow, FormationRow } from "@/lib/types/db";
import {
  buildDemoVMs,
  effectiveStatus,
  roomById,
  stripDemoSuffix,
  type FormationVM,
} from "./model";
import {
  appendStoredFormation,
  getFormationsSnapshot,
  getServerFormationsSnapshot,
  subscribeFormations,
} from "./store";
import { duplicateFormation } from "./duplicate";
import { FormationCard } from "./FormationCard";
import { Modal } from "./Modal";
import { ToastViewport, useToast } from "./Toast";
import { appLocaleTag } from "@/lib/intl-locale";

type Segment = "all" | "open" | "full" | "completed";
const SEGMENTS: Array<{ key: Segment; labelKey: "segmentAll" | "segmentOpen" | "segmentFull" | "segmentCompleted" }> = [
  { key: "all", labelKey: "segmentAll" },
  { key: "open", labelKey: "segmentOpen" },
  { key: "full", labelKey: "segmentFull" },
  { key: "completed", labelKey: "segmentCompleted" },
];

interface CreateFormState {
  title: string;
  roomId: string;
  date: string;
  start: string;
  end: string;
  capacity: string;
  price: string;
  description: string;
}

const EMPTY_FORM: CreateFormState = {
  title: "",
  roomId: "",
  date: "",
  start: "09:00",
  end: "12:00",
  capacity: "20",
  price: "1200",
  description: "",
};

function localTodayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function FormationsClient({ data }: { data?: FormationListData | null }) {
  const t = useTranslations("formations");
  const router = useRouter();
  const live = data != null && data.live;
  const rooms = data?.rooms ?? DEMO_ROOMS;
  const categories = data?.categories ?? [];
  const formationCategory =
    categories.find((c) => c.type === "formation" && c.is_system) ??
    categories.find((c) => c.type === "formation") ??
    categories[0] ??
    null;
  const { toasts, push, dismiss } = useToast();
  // Locally created formations (sessionStorage) + demo dataset, merged.
  const storedFormations = useSyncExternalStore(
    subscribeFormations,
    getFormationsSnapshot,
    getServerFormationsSnapshot,
  );
  const vms = useMemo<FormationVM[]>(() => {
    if (data) return data.vms;
    const demo = buildDemoVMs();
    if (storedFormations.length === 0) return demo;
    const demoIds = new Set(demo.map((vm) => vm.booking.id));
    const extras = storedFormations
      .filter((stored) => !demoIds.has(stored.booking.id))
      .map((stored) => ({ booking: stored.booking, formation: stored.formation, participants: [] }));
    return [...extras, ...demo];
  }, [data, storedFormations]);
  const [segment, setSegment] = useState<Segment>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const result: Record<Segment, number> = { all: vms.length, open: 0, full: 0, completed: 0 };
    for (const vm of vms) {
      const status = effectiveStatus(vm);
      if (status === "open" || status === "ongoing") result.open += 1;
      else if (status === "full") result.full += 1;
      else if (status === "completed") result.completed += 1;
    }
    return result;
  }, [vms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vms.filter((vm) => {
      const status = effectiveStatus(vm);
      if (segment === "open" && !(status === "open" || status === "ongoing")) return false;
      if (segment === "full" && status !== "full") return false;
      if (segment === "completed" && status !== "completed") return false;
      if (q) {
        const room = roomById(vm.booking.room_id, rooms);
        const haystack = [
          vm.booking.title,
          room ? stripDemoSuffix(room.name) : "",
          room?.location ?? "",
          vm.formation.description ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [vms, segment, query, rooms]);

  /* ---------- duplicate ---------- */
  async function handleDuplicate(vm: FormationVM) {
    if (live) {
      const starts = new Date(vm.booking.starts_at);
      starts.setDate(starts.getDate() + 7);
      const ends = new Date(vm.booking.ends_at);
      ends.setDate(ends.getDate() + 7);
      const res = await createFormationAction({
        title: vm.booking.title + " (copy)",
        categoryId: formationCategory?.id ?? vm.booking.category_id,
        roomId: vm.booking.room_id,
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
        capacity: vm.formation.capacity,
        priceLabel: vm.formation.price_label ?? null,
        description: vm.formation.description ?? null,
      });
      if (!res.ok) return push(res.error.message, "error");
      push(t("duplicateToastSame", { date: new Intl.DateTimeFormat(appLocaleTag(), { day: "numeric", month: "short" }).format(starts) }));
      router.refresh();
      return;
    }
    const { booking } = duplicateFormation(vm);
    // Persisting emits the change event this list subscribes to.
    push(t("duplicateToastMoved", { date: new Intl.DateTimeFormat(appLocaleTag(), { day: "numeric", month: "short" }).format(new Date(booking.starts_at)) }));
  }

  /* ---------- create ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setForm((current) => {
      const base = { ...EMPTY_FORM, date: localTodayISO(), roomId: rooms[0]?.id ?? "" };
      return current.date ? { ...current, roomId: current.roomId || base.roomId } : { ...base, ...current, date: current.date || base.date };
    });
    setFormError(null);
    setCreateOpen(true);
  }

  function updateField<K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return setFormError(t("errorTitle"));
    if (!form.date) return setFormError(t("errorDate"));
    if (!form.start || !form.end || form.start >= form.end)
      return setFormError(t("errorEndAfterStart"));
    const capacity = Number(form.capacity);
    if (!Number.isFinite(capacity) || capacity < 1)
      return setFormError(t("errorCapacity"));

    const startsAt = new Date(`${form.date}T${form.start}:00`);
    const endsAt = new Date(`${form.date}T${form.end}:00`);
    const id = `bk-local-${Date.now()}`;
    const booking: BookingRow = {
      id,
      type: "formation",
      title,
      category_id: "cat-formation",
      room_id: form.roomId,
      client_id: null,
      created_by: "demo-admin",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
      price: null,
      notes: null,
    };
    const formation: FormationRow = {
      booking_id: id,
      capacity: Math.floor(capacity),
      description: form.description.trim() || null,
      price_label: form.price.trim() ? Number(form.price) : null,
      status: "open",
    };

    if (live) {
      const res = await createFormationAction({
        title,
        categoryId: formationCategory?.id ?? "",
        roomId: form.roomId || null,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        capacity: Math.floor(capacity),
        priceLabel: form.price.trim() ? Number(form.price) : null,
        description: form.description.trim() || null,
      });
      if (!res.ok) {
        setFormError(res.error.code === "room_conflict" ? t("errorRoomConflict") : res.error.message);
        return;
      }
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM, roomId: rooms[0]?.id ?? "", date: localTodayISO() });
      push(t("createdToast"));
      router.refresh();
      return;
    }
    appendStoredFormation({ booking, formation });

    setCreateOpen(false);
    setForm({ ...EMPTY_FORM, date: localTodayISO() });
    push(t("createdToast"));
  }

  const hasActiveFilters = segment !== "all" || query.trim() !== "";

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.04em] text-obsidian sm:text-[32px]">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-[14px] font-medium leading-snug text-obsidian-light">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="segmented max-w-full overflow-x-auto" role="group" aria-label={t("filterByStatusLabel")}>
            {SEGMENTS.map(({ key, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSegment(key)}
                aria-pressed={segment === key}
                className={`segment px-3 sm:px-4 ${segment === key ? "segment-active" : ""}`}
              >
                {t(labelKey)}
                <span className="ml-1.5 hidden text-[11px] font-bold tabular-nums text-muted sm:inline">{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <label htmlFor="formation-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <input
              id="formation-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="input h-11 w-40 pl-10 sm:w-56"
            />
          </div>
          <button type="button" onClick={openCreate} className="btn btn-primary h-11 shadow-electric">
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            {t("newFormation")}
          </button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((vm) => (
            <FormationCard key={vm.booking.id} vm={vm} onDuplicate={handleDuplicate} rooms={rooms} />
          ))}
        </div>
      ) : (
        <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
          <NowBarMark size={52} className="opacity-90" />
          <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.03em] text-obsidian">
            {query.trim() ? t("emptyNoMatch", { query: query.trim() }) : t("emptyNone")}
          </h2>
          <p className="mt-1.5 max-w-md text-[14px] leading-snug text-obsidian-light">
            {t("emptyBody")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSegment("all");
                  setQuery("");
                }}
                className="btn btn-secondary h-10 px-5 text-[14px]"
              >
                {t("clearFilters")}
              </button>
            )}
            <button type="button" onClick={openCreate} className="btn btn-primary h-10 px-5 text-[14px]">
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              {t("newFormation")}
            </button>
          </div>
        </div>
      )}

      {/* Result count (screen-reader + subtle sighted label) */}
      <p aria-live="polite" className="mt-4 text-center text-[12px] font-medium tabular-nums text-muted">
        {t("resultsShown", { shown: filtered.length, total: vms.length })}
      </p>

      {/* Create modal */}
      {createOpen && (
        <Modal
          title={t("newFormation")}
          description={t("createModalDescription")}
          onClose={() => setCreateOpen(false)}
          size="lg"
        >
          <form onSubmit={submitCreate} noValidate className="grid gap-4">
            <div>
              <label htmlFor="nf-title" className="label">{t("labelTitle")}</label>
              <input
                id="nf-title"
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="React Avancé — Session 5"
                className="input"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nf-room" className="label">{t("labelRoom")}</label>
                <select
                  id="nf-room"
                  value={form.roomId}
                  onChange={(e) => updateField("roomId", e.target.value)}
                  className="input"
                >
                  {DEMO_ROOMS.map((room) => (
                    <option key={room.id} value={room.id}>
                      {stripDemoSuffix(room.name)} · {room.location}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="nf-date" className="label">{t("labelDate")}</label>
                <input
                  id="nf-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => updateField("date", e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="nf-start" className="label">{t("labelStart")}</label>
                <input
                  id="nf-start"
                  type="time"
                  value={form.start}
                  onChange={(e) => updateField("start", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="nf-end" className="label">{t("labelEnd")}</label>
                <input
                  id="nf-end"
                  type="time"
                  value={form.end}
                  onChange={(e) => updateField("end", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="nf-capacity" className="label">{t("labelCapacity")}</label>
                <input
                  id="nf-capacity"
                  type="number"
                  min={1}
                  max={500}
                  inputMode="numeric"
                  value={form.capacity}
                  onChange={(e) => updateField("capacity", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="nf-price" className="label">{t("labelPricePerSeat")}</label>
                <div className="relative">
                  <input
                    id="nf-price"
                    type="number"
                    min={0}
                    step={50}
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
                    className="input pr-12 font-mono"
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted">
                    MAD
                  </span>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="nf-description" className="label">{t("labelDescription")}</label>
              <textarea
                id="nf-description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder={t("placeholderDescription")}
                rows={3}
                className="input h-auto min-h-[84px] py-3 leading-snug"
              />
            </div>

            {formError && (
              <p role="alert" className="rounded-sm border border-error/30 bg-error-tint px-4 py-2.5 text-[13px] font-semibold text-error">
                {formError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
              <p className="flex items-center gap-2 text-[12px] font-medium text-muted">
                <CalendarDays size={14} aria-hidden="true" />
                {t("savedLocallyNote")}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-ghost h-11 px-5 text-[14px]">
                  {t("cancel")}
                </button>
                <button type="submit" className="btn btn-primary h-11">
                  <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
                  {t("createFormation")}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
