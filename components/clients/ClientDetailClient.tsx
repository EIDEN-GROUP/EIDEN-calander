/**
 * Client detail — profile, contact, bookings and notes for one renting customer.
 * Demo data (DEMO_CLIENTS / getDemoBookings) + local state.
 * Live mode: data comes from the server; mutations call server actions
 * (addClientNoteAction, anonymizeClientAction). Demo mode persists locally.
 */

"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { appLocaleTag } from "@/lib/intl-locale";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  FileJson,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  StickyNote,
  Tag,
} from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";
import { DEMO_CLIENTS, getDemoBookings } from "@/lib/demo-data";
import { useRouter } from "next/navigation";
import { anonymizeClientAction, addClientNoteAction } from "@/app/actions/clients";
import type { ClientDetailData } from "@/lib/clients-live";
import type { ClientRow } from "@/lib/types/db";
import { downloadBlob, getClientsSnapshot, getServerClientsSnapshot, subscribeClients } from "./store";
import { Avatar, hashString } from "@/components/formations/Avatar";
import { Modal } from "@/components/formations/Modal";
import { StatusChip, type ChipTone } from "@/components/formations/StatusChip";
import { ToastViewport, useToast } from "@/components/formations/Toast";
import { formatDuration, formatTime, formatTimeRange, roomById, stripDemoSuffix } from "@/components/formations/model";

const STATUS_META: Record<ClientRow["status"], { labelKey: "statusLead" | "statusActive" | "statusInactive"; tone: ChipTone }> = {
  lead: { labelKey: "statusLead", tone: "warning" },
  active: { labelKey: "statusActive", tone: "success" },
  inactive: { labelKey: "statusInactive", tone: "muted" },
};

type Tab = "overview" | "bookings" | "notes";
const TABS: Array<{ key: Tab; labelKey: "tabOverview" | "tabBookings" | "tabNotes" }> = [
  { key: "overview", labelKey: "tabOverview" },
  { key: "bookings", labelKey: "tabBookings" },
  { key: "notes", labelKey: "tabNotes" },
];

/* Demo notes per client — timestamps derived at render so they always look fresh. */
const DEMO_NOTES: Record<string, Array<{ body: string; hoursAgo: number }>> = {
  "cli-1": [
    { body: "Monthly board meeting, always 09:30 — prefers Salle Grande. Billing net-30.", hoursAgo: 24 * 6 },
    { body: "Asked for a catering quote for the March committee — send after Monday.", hoursAgo: 26 },
  ],
  "cli-2": [
    { body: "Events team prepays by invoice; PO required for amounts above 5 000 MAD.", hoursAgo: 24 * 12 },
  ],
  "cli-3": [{ body: "Prefers Agadir mornings. Attends every React session — front row.", hoursAgo: 24 * 9 }],
  "cli-4": [
    { body: "Negotiating annual rate — promising 12 sessions per quarter. Hold current price for now.", hoursAgo: 24 * 3 },
  ],
  "cli-5": [
    { body: "Confirmed as speaker for React Avancé S3 next cohort. Send rider + AV checklist.", hoursAgo: 24 * 2 },
  ],
  "cli-7": [{ body: "Asked about formation pricing — send Agile Module 1 brochure.", hoursAgo: 24 * 4 }],
};

interface NoteEntry {
  id: string;
  body: string;
  createdAt: string;
}

const MONTH_KEYS = [
  "monthJanuary", "monthFebruary", "monthMarch", "monthApril", "monthMay", "monthJune",
  "monthJuly", "monthAugust", "monthSeptember", "monthOctober", "monthNovember", "monthDecember",
] as const;

const noteDayFmt = (tag?: string) => new Intl.DateTimeFormat(tag ?? appLocaleTag(), { day: "numeric", month: "short" });
const noteTimeFmt = (tag?: string) => new Intl.DateTimeFormat(tag ?? appLocaleTag(), { hour: "2-digit", minute: "2-digit", hour12: false });
const bookingDayFmt = (tag?: string) => new Intl.DateTimeFormat(tag ?? appLocaleTag(), { weekday: "short", day: "numeric", month: "short" });

const BOOKING_STATUS_META: Record<string, { labelKey: "bookingConfirmed" | "bookingPendingConflict" | "bookingCancelled" | "bookingPaused" | "bookingCompleted"; tone: ChipTone }> = {
  confirmed: { labelKey: "bookingConfirmed", tone: "success" },
  pending_conflict: { labelKey: "bookingPendingConflict", tone: "warning" },
  cancelled: { labelKey: "bookingCancelled", tone: "error" },
  paused: { labelKey: "bookingPaused", tone: "warning" },
  completed: { labelKey: "bookingCompleted", tone: "muted" },
};

const SOURCE_KEYS: Record<string, "sourceReferral" | "sourceWeb" | "sourceWalkin" | "sourcePartner" | "sourceEvent"> = {
  referral: "sourceReferral",
  web: "sourceWeb",
  "walk-in": "sourceWalkin",
  partner: "sourcePartner",
  event: "sourceEvent",
};

const subscribeMounted = () => () => {};

export function ClientDetailClient({
  id,
  data,
}: {
  id: string;
  data?: ClientDetailData | null;
}) {
  const t = useTranslations("clients");
  const intlLocale = appLocaleTag(useLocale());
  const liveClient = data?.client ?? null;
  const liveBookings = data?.bookings ?? null;
  const demoClient = useMemo<ClientRow | null>(
    () => DEMO_CLIENTS.find((c) => c.id === id) ?? null,
    [id],
  );
  // SSR + first client render see an empty snapshot (skeleton below);
  // after mount, sessionStorage becomes readable for locally created ids.
  const stored = useSyncExternalStore(
    subscribeClients,
    getClientsSnapshot,
    getServerClientsSnapshot,
  );
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
  const client =
    liveClient ?? demoClient ?? stored.find((c) => c.id === id) ?? null;

  if (client)
    return (
      <ClientDetailView
        key={client.id}
        client={client}
        bookings={liveBookings ?? undefined}
        live={data?.live === true}
      />
    );
  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1440px]" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded-pill bg-track" />
        <div className="card mt-4 h-[180px] animate-pulse bg-canvas" />
        <p className="sr-only">{t("loadingClient")}</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1440px]">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted transition-colors hover:text-obsidian">
        <ChevronLeft size={15} aria-hidden="true" />
        {t("title")}
      </Link>
      <div className="card mt-4 flex flex-col items-center px-6 py-20 text-center">
        <NowBarMark size={52} className="opacity-90" />
        <h1 className="mt-5 text-[22px] font-extrabold tracking-[-0.03em] text-obsidian">
          {t("notFoundTitle")}
        </h1>
        <p className="mt-1.5 max-w-md text-[14px] leading-snug text-obsidian-light">
          {t("notFoundBody")}
        </p>
        <Link href="/clients" className="btn btn-primary mt-6 h-11">
          <ArrowLeft size={17} aria-hidden="true" />
          {t("backToClients")}
        </Link>
      </div>
    </div>
  );
}

function ClientDetailView({
  client,
  bookings: bookingsProp,
  live,
}: {
  client: ClientRow;
  bookings?: import("@/lib/types/db").BookingRow[];
  live: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("clients");
  const intlLocale = appLocaleTag(useLocale());
  const id = client.id;
  const { toasts, push, dismiss } = useToast();
  const [anonymized, setAnonymized] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  /* ---------- notes ---------- */
  const [notes, setNotes] = useState<NoteEntry[]>(() =>
    live
      ? (client.notes ?? "")
          .split(/\n\n+/)
          .map((chunk) => chunk.trim())
          .filter(Boolean)
          .reverse()
          .map((chunk, index) => {
            const m = chunk.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
            return {
              id: `note-${index}`,
              body: m ? m[2] : chunk,
              createdAt: m ? m[1].split(" · ")[0] : new Date().toISOString(),
            };
          })
      : (DEMO_NOTES[id] ?? []).map((n, index) => ({
          id: `demo-note-${index}`,
          body: n.body,
          createdAt: new Date(Date.now() - n.hoursAgo * 3_600_000).toISOString(),
        })),
  );
  const [noteDraft, setNoteDraft] = useState("");

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = noteDraft.trim();
    if (!body) return;
    if (live) {
      const res = await addClientNoteAction({ clientId: id, note: body });
      if (!res.ok) {
        push(res.error.message, "error");
        return;
      }
      setNotes((current) => [
        { id: `note-${Date.now()}`, body, createdAt: new Date().toISOString() },
        ...current,
      ]);
      setNoteDraft("");
      push(t("toastNoteAdded"));
      router.refresh();
      return;
    }
    setNotes((current) => [
      { id: `note-local-${Date.now()}`, body, createdAt: new Date().toISOString() },
      ...current,
    ]);
    setNoteDraft("");
    push(t("toastNoteAdded"));
  }

  const meta = STATUS_META[client.status];
  const displayName = anonymized ? "Client #ANON" : client.full_name;
  const confirmMatches = confirmName.trim() === client.full_name;
  const bookings = (bookingsProp ?? getDemoBookings()).filter((b) => b.client_id === client.id);
  const outstanding = bookings.filter((b) => b.status === "pending_conflict").length;
  const stats = {
    totalBookings: bookings.length,
    formationsAttended: bookings.filter((b) => b.type === "formation").length,
    outstanding,
  };
  const memberSince = client.created_at
    ? `${t(MONTH_KEYS[new Date(client.created_at).getMonth()])} ${new Date(client.created_at).getFullYear()}`
    : t(MONTH_KEYS[hashString(client.id) % 12]) + " " + (2023 + (hashString(client.id) % 3));
  const sourceLabel = client.source
    ? (SOURCE_KEYS[client.source] ? t(SOURCE_KEYS[client.source]) : client.source.charAt(0).toUpperCase() + client.source.slice(1))
    : "—";

  function exportJson() {
    const payload = anonymized
      ? {
          id: client.id,
          type: client.type,
          full_name: "Client #ANON",
          company: null,
          email: null,
          phone: null,
          address: null,
          city: null,
          tags: [],
          status: client.status,
          anonymized_at: new Date().toISOString(),
        }
      : { ...client };
    const blob = new Blob(
      [JSON.stringify({ ...payload, exported_at: new Date().toISOString(), ...(live ? {} : { _demo: true }) }, null, 2)],
      { type: "application/json" },
    );
    downloadBlob(blob, `client-${client.id}.json`);
    push(t("toastExportJson"));
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Back link */}
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted transition-colors hover:text-obsidian">
        <ChevronLeft size={15} aria-hidden="true" />
        {t("title")}
      </Link>

      {/* Anonymization banner */}
      {anonymized && (
        <div role="alert" className="mt-3 flex items-start gap-3 rounded-sm border border-border bg-track px-4 py-3 text-[13px] font-semibold text-obsidian-light">
          <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-electric" />
          <div>
            <p>{t("anonymizedBannerTitle")}</p>
            <p className="mt-0.5 font-medium text-muted">{t("anonymizedBannerBody")}</p>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="card mt-4 flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          {anonymized ? (
            <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-pill bg-track text-muted">
              <ShieldCheck size={30} strokeWidth={1.75} />
            </span>
          ) : (
            <Avatar name={client.full_name} kind={client.type} size={64} />
          )}
          <div className="min-w-0">
            <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-obsidian">
              {displayName}
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-obsidian-light">
              {anonymized
                ? t("redactedDetails")
                : client.company && client.company !== client.full_name
                  ? client.company
                  : (client.city ?? (client.type === "company" ? t("typeCompany") : t("typeIndividual")))}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip tone={meta.tone} dot>{t(meta.labelKey)}</StatusChip>
              <span className="chip bg-track text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                {client.type === "company" ? t("typeCompany") : t("typePerson")}
              </span>
              {!anonymized &&
                client.tags.map((tag) => (
                  <span key={tag} className="chip bg-track text-[10px] font-semibold text-obsidian-light">
                    {tag}
                  </span>
                ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/calendar?client=' + encodeURIComponent(client.id))}
            className="btn btn-primary h-10 px-4 text-[13px]"
          >
            <CalendarPlus size={16} aria-hidden="true" />
            {t("newBooking")}
          </button>
          <button
            type="button"
            onClick={() => push(t("toastAddToFormationDemo", { name: client.full_name }), "info")}
            className="btn btn-secondary h-10 px-4 text-[13px]"
          >
            <GraduationCap size={16} aria-hidden="true" />
            {t("enrollInFormation")}
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="btn btn-secondary h-10 px-4 text-[13px]"
          >
            <FileJson size={16} aria-hidden="true" />
            {t("exportJson")}
          </button>
          {!anonymized && (
            <button
              type="button"
              onClick={() => { setConfirmName(""); setAnonymizeOpen(true); }}
              className="btn h-10 border border-error/30 bg-error-tint px-4 text-[13px] font-bold text-error transition-colors hover:bg-error hover:text-white"
            >
              <AlertTriangle size={15} aria-hidden="true" />
              {t("anonymize")}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="segmented mt-5" role="tablist" aria-label={t("tabListAria")}>
        {TABS.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
            className={`segment ${tab === key ? "segment-active" : ""}`}
          >
            {t(labelKey)}
            {key === "bookings" && (
              <span className="ml-1.5 text-[11px] font-bold tabular-nums text-muted">{bookings.length}</span>
            )}
            {key === "notes" && (
              <span className="ml-1.5 text-[11px] font-bold tabular-nums text-muted">{notes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ============ Overview tab ============ */}
      {tab === "overview" && (
        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="mt-5 grid items-start gap-5 lg:grid-cols-5">
          {/* Contact details */}
          <section className="card p-5 sm:p-6 lg:col-span-3" aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="text-[15px] font-extrabold tracking-[-0.02em] text-obsidian">
              {t("contactDetails")}
            </h2>
            <dl className="mt-4 divide-y divide-divider">
              <ContactRow icon={Mail} label={t("labelEmail")}>
                {anonymized ? "—" : client.email ?? "—"}
              </ContactRow>
              <ContactRow icon={Phone} label={t("labelPhone")}>
                {anonymized ? "—" : <span className="tabular-nums">{client.phone ?? "—"}</span>}
              </ContactRow>
              <ContactRow icon={MapPin} label={t("labelAddress")}>
                {anonymized ? "—" : (client.address ?? "—")}
              </ContactRow>
              <ContactRow icon={Building2} label={t("labelCity")}>
                {anonymized ? "—" : client.city ?? "—"}
              </ContactRow>
              <ContactRow icon={Tag} label={t("labelSource")}>
                {sourceLabel}
              </ContactRow>
              <ContactRow icon={CalendarDays} label={t("labelMemberSince")}>
                {anonymized ? "—" : memberSince}
              </ContactRow>
            </dl>
            {!anonymized && client.notes && (
              <div className="mt-4 rounded-sm border border-border bg-canvas px-4 py-3">
                <p className="label mb-1">{t("accountNotes")}</p>
                <p className="text-[13px] leading-snug text-obsidian-light">{client.notes}</p>
              </div>
            )}
          </section>

          {/* Quick stats */}
          <section className="card p-5 sm:p-6 lg:col-span-2" aria-labelledby="stats-heading">
            <h2 id="stats-heading" className="text-[15px] font-extrabold tracking-[-0.02em] text-obsidian">
              {t("quickStats")}
            </h2>
            <dl className="mt-3 divide-y divide-divider">
              <StatRow label={t("statTotalBookings")} value={stats.totalBookings} hint={t("statTotalHint")} />
              <StatRow label={t("statFormations")} value={stats.formationsAttended} hint={t("statFormationsHint")} />
              <StatRow label={t("statOutstanding")} value={stats.outstanding} hint={t("statOutstandingHint")} alert={stats.outstanding > 0} />
            </dl>
            {!live && (
              <p className="mt-4 border-t border-divider pt-4 text-[11px] font-medium leading-snug text-muted">
                {t("demoFigures")}
              </p>
            )}
          </section>
        </div>
      )}

      {/* ============ Bookings tab ============ */}
      {tab === "bookings" && (
        <div role="tabpanel" id="panel-bookings" aria-labelledby="tab-bookings" className="mt-5">
          <section className="card p-5 sm:p-6" aria-labelledby="bookings-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="bookings-heading" className="text-[15px] font-extrabold tracking-[-0.02em] text-obsidian">
                {t("bookingsHistory")}
              </h2>
              {bookings.length > 0 && (
                <span className="chip bg-track tabular-nums text-muted">{t("onRecord", { count: bookings.length })}</span>
              )}
            </div>
            {bookings.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {bookings
                  .slice()
                  .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
                  .map((booking) => {
                    const bookingStatus = BOOKING_STATUS_META[booking.status] ?? BOOKING_STATUS_META.confirmed;
                    const room = roomById(booking.room_id);
                    const title = anonymized ? t("bookingRedacted") : booking.title;
                    return (
                      <li key={booking.id} className="flex items-stretch gap-4 rounded-sm border border-border bg-canvas p-4">
                        <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-border pr-4 text-center">
                          <span className="text-[16px] font-extrabold tabular-nums leading-none text-obsidian">
                            {formatTime(booking.starts_at)}
                          </span>
                          <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                            {bookingDayFmt(intlLocale).format(new Date(booking.starts_at))}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-bold text-obsidian" title={title}>{title}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-obsidian-light">
                            <span className="inline-flex items-center gap-1.5">
                              <DoorOpen size={13} aria-hidden="true" className="text-muted" />
                              {room ? `${stripDemoSuffix(room.name)} · ${room.location}` : t("offsiteRoomTbd")}
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <Clock size={13} aria-hidden="true" className="text-muted" />
                              {formatTimeRange(booking.starts_at, booking.ends_at)} · {formatDuration(booking.starts_at, booking.ends_at)}
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <StatusChip tone={bookingStatus?.tone ?? "muted"} dot>{bookingStatus ? t(bookingStatus.labelKey) : t("bookingUnknown")}</StatusChip>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <div className="mt-4">
                <p className="text-[13px] font-medium text-obsidian-light">
                  {t("noBookings")}
                </p>
                <ul className="mt-3 space-y-3">
                  {[
                    { title: "Quarterly board meeting", room: "Salle Grande · Casablanca", day: "In 2 weeks", price: "900 MAD" },
                    { title: "Marketing offsite — half day", room: "Salle Formation · Casablanca", day: "Last month", price: "1 800 MAD" },
                    { title: "Onboarding session", room: "Salle Petite · Agadir", day: "3 months ago", price: "500 MAD" },
                  ].map((sample) => (
                    <li key={sample.title} className="flex items-stretch gap-4 rounded-sm border border-dashed border-border bg-canvas p-4 opacity-80">
                      <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-border pr-4 text-center">
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{t("sample")}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-obsidian">{sample.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] font-medium text-obsidian-light">
                          <span className="inline-flex items-center gap-1.5"><DoorOpen size={13} aria-hidden="true" className="text-muted" />{sample.room}</span>
                          <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden="true" className="text-muted" />{sample.day}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <span className="font-mono text-[12px] font-semibold text-muted">{sample.price}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ============ Notes tab ============ */}
      {tab === "notes" && (
        <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" className="mt-5">
          <section className="card p-5 sm:p-6" aria-labelledby="notes-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="notes-heading" className="text-[15px] font-extrabold tracking-[-0.02em] text-obsidian">
                {t("accountNotes")}
              </h2>
              <span className="chip bg-track tabular-nums text-muted">{t("onRecord", { count: anonymized ? 0 : notes.length })}</span>
            </div>

            {anonymized ? (
              <p role="status" className="mt-6 rounded-sm border border-border bg-canvas px-4 py-6 text-center text-[13px] font-medium text-muted">
                {t("notesRedacted")}
              </p>
            ) : (
              <>
                <form onSubmit={addNote} className="mt-4">
                  <label htmlFor="note-draft" className="label">{t("addANote")}</label>
                  <textarea
                    id="note-draft"
                    rows={2}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={t("placeholderNote")}
                    className="input h-auto min-h-[64px] py-3 leading-snug"
                  />
                  <div className="mt-2 flex justify-end">
                    <button type="submit" disabled={noteDraft.trim().length === 0} className="btn btn-primary h-10 px-5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50">
                      <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                      {t("addNote")}
                    </button>
                  </div>
                </form>

                <ul aria-live="polite" className="mt-4 space-y-3">
                  {notes.map((note) => (
                    <li key={note.id} className="rounded-sm border border-border bg-canvas p-4">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.09em] text-muted">
                        <StickyNote size={12} aria-hidden="true" />
                        {noteDayFmt(intlLocale).format(new Date(note.createdAt))} · {noteTimeFmt(intlLocale).format(new Date(note.createdAt))}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-snug text-obsidian">{note.body}</p>
                    </li>
                  ))}
                  {notes.length === 0 && (
                    <li className="rounded-sm border border-dashed border-border px-4 py-8 text-center text-[13px] font-medium text-muted">
                      {t("noNotes")}
                    </li>
                  )}
                </ul>
              </>
            )}
          </section>
        </div>
      )}

      {/* ============ Anonymize modal ============ */}
      {anonymizeOpen && (
        <Modal
          title={t("anonymizeTitle")}
          description={t("anonymizeDescription")}
          onClose={() => setAnonymizeOpen(false)}
        >
          <ul className="space-y-1.5 rounded-sm border border-border bg-canvas px-4 py-3 text-[13px] font-medium leading-snug text-obsidian-light">
            <li className="flex items-start gap-2"><ChevronRight size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />{t("anonymizeItemName")}</li>
            <li className="flex items-start gap-2"><ChevronRight size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />{t("anonymizeItemContact")}</li>
            <li className="flex items-start gap-2"><ChevronRight size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />{t("anonymizeItemTags")}</li>
            <li className="flex items-start gap-2"><ChevronRight size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />{t("anonymizeItemBookings")}</li>
          </ul>
          <label htmlFor="anon-confirm" className="label mt-4">
            {t("anonymizeConfirmLabel", { name: client.full_name })}
          </label>
          <input
            id="anon-confirm"
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={client.full_name}
            className="input"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-divider pt-4">
            <button type="button" onClick={() => setAnonymizeOpen(false)} className="btn btn-ghost h-11 px-5 text-[14px]">
              {t("keepClient")}
            </button>
            <button
              type="button"
              disabled={!confirmMatches}
              onClick={() => {
                if (live) {
                  void (async () => {
                    const res = await anonymizeClientAction({ clientId: client.id, confirmName });
                    if (!res.ok) {
                      push(res.error.message, "error");
                      return;
                    }
                    setAnonymized(true);
                    setAnonymizeOpen(false);
                    setConfirmName("");
                    push(t("toastClientAnonymized"), "info");
                    router.refresh();
                  })();
                  return;
                }
                setAnonymized(true);
                setAnonymizeOpen(false);
                setConfirmName("");
                push(t("toastClientAnonymized"), "info");
              }}
              className="btn h-11 bg-error px-6 text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShieldCheck size={16} aria-hidden="true" />
              {t("anonymizeConfirm")}
            </button>
          </div>
        </Modal>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-[13px] font-semibold text-obsidian">{children}</dd>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: number;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <dt className="text-[13px] font-semibold text-obsidian-light">{label}</dt>
        <dd className="mt-0.5 text-[11px] font-medium text-muted">{hint}</dd>
      </div>
      <p className={`text-[28px] font-extrabold tabular-nums leading-none tracking-[-0.03em] ${alert ? "text-error" : "text-obsidian"}`}>
        {value}
      </p>
    </div>
  );
}
