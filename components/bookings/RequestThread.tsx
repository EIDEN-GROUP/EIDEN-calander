"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { respondToChangeRequestAction, cancelChangeRequestAction } from "@/app/actions/bookings";
import Link from "next/link";
import {
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  DoorOpen,
  Hourglass,
  Send,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  DEMO_CHANGE_REQUESTS,
  DEMO_CLIENTS,
  DEMO_ROOMS,
  getDemoBookings,
} from "@/lib/demo-data";
import { useTranslations, useLocale } from "next-intl";
import type { BookingRow, ChangeRequestRow } from "@/lib/types/db";
import {
  creatorName,
  formatTime,
  shortRef,
} from "@/components/calendar/calendar-utils";
import { appLocaleTag } from "@/lib/intl-locale";

const DEMO_BOOKINGS = getDemoBookings();
const TTL_HOURS = 72;

export interface LiveChangeRequest {
  id: string;
  status: "pending" | "approved" | "declined" | "cancelled" | "expired";
  message: string | null;
  responseMessage: string | null;
  createdAt: string;
  expiresAt: string;
  suggestedSlots: Array<{ startsAt: string; endsAt: string }>;
  newBooking: import("@/lib/types/db").BookingRow;
  conflictingBooking: import("@/lib/types/db").BookingRow;
  requesterName: string;
  incumbentName: string;
  clientName: string | null;
  roomName: string | null;
  roomLocation: string | null;
}

type Perspective = "requester" | "incumbent";
type Outcome = "pending" | "approved" | "declined" | "cancelled";

interface ThreadMessage {
  id: string;
  author: Perspective;
  body: string;
  at: string;
}

/**
 * Negotiation thread between the requester (new booking) and the incumbent
 * (existing booking). Demo-only: every action applies local state.
 *
 * Live mode receives the request from the server page (loadLiveRequest).
 * Demo mode falls back to the built-in demo fixtures.
 */
export function RequestThread({
  changeRequestId,
  serverNow,
  live = null,
}: {
  changeRequestId: string;
  serverNow: string;
  live?: LiveChangeRequest | null;
}) {
  const t = useTranslations("requests");
  const intlLocale = appLocaleTag(useLocale());
  const liveData = live;
  const cr = useMemo(() => {
    if (liveData) {
      return {
        id: liveData.id,
        new_booking_id: liveData.newBooking.id,
        conflicting_booking_id: liveData.conflictingBooking.id,
        requested_by: "live",
        assigned_to: "live",
        message: liveData.message,
        response_message: liveData.responseMessage,
        created_at: liveData.createdAt,
        expires_at: liveData.expiresAt,
        suggested_slots: liveData.suggestedSlots.map((s) => ({ starts_at: s.startsAt, ends_at: s.endsAt })),
        status: liveData.status,
      };
    }
    return resolveChangeRequest(changeRequestId);
  }, [changeRequestId, liveData]);
  const fallback = false;

  const ref = shortRef(cr.id);

  const newBooking = liveData?.newBooking ?? DEMO_BOOKINGS.find((b) => b.id === cr.new_booking_id) ?? null;
  const oldBooking = liveData?.conflictingBooking ?? DEMO_BOOKINGS.find((b) => b.id === cr.conflicting_booking_id) ?? null;
  const roomName = liveData?.roomName ??
    (newBooking?.room_id
      ? (DEMO_ROOMS.find((r) => r.id === newBooking.room_id)?.name.replace(/\s*\(DEMO\)\s*$/, "") ?? t("offSite"))
      : t("offSite"));

  const router = useRouter();
  const createdAt = new Date(cr.created_at);
  const expiresAt = new Date(cr.expires_at);

  const [perspective, setPerspective] = useState<Perspective>("incumbent");
  const [outcome, setOutcome] = useState<Outcome>(outcomeFromStatus(cr.status));
  const [approvedSlot, setApprovedSlot] = useState<{
    starts_at: string;
    ends_at: string;
  } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [messages, setMessages] = useState<ThreadMessage[]>(() => {
    const seed: ThreadMessage[] = [];
    if (cr.message) {
      seed.push({ id: "m-seed-1", author: "requester", body: cr.message, at: cr.created_at });
    }
    if (cr.response_message) {
      seed.push({
        id: "m-seed-2",
        author: "incumbent",
        body: cr.response_message,
        at: cr.created_at,
      });
    }
    return seed;
  });

  // Live countdown to the 72h expiry
  const [now, setNow] = useState<Date>(() => new Date(serverNow));
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const msLeft = expiresAt.getTime() - now.getTime();
  const countdown = formatCountdown(msLeft, (key, values) => t(key, values));
  const windowFraction = Math.min(
    1,
    Math.max(0, (now.getTime() - createdAt.getTime()) / (expiresAt.getTime() - createdAt.getTime())),
  );

  const roomLocation = liveData?.roomLocation
    ?? (newBooking?.room_id
      ? DEMO_ROOMS.find((r) => r.id === newBooking.room_id)?.location ?? null
      : null);
  const clientNameFor = (b: BookingRow): string | null =>
    liveData ? (b.id === liveData.newBooking.id ? liveData.clientName : null) : clientNameOf(b);
  const requester = liveData?.requesterName ?? creatorName(cr.requested_by);
  const incumbent = liveData?.incumbentName ?? creatorName(cr.assigned_to);

  const handleApprove = async (slot: { starts_at: string; ends_at: string }) => {
    if (liveData) {
      const res = await respondToChangeRequestAction({
        requestId: liveData.id,
        decision: "approve",
        slot: { startsAt: slot.starts_at, endsAt: slot.ends_at },
      });
      if (!res.ok) {
        setAnnouncement(res.error.message);
        return;
      }
    }
    router.refresh();
    setApprovedSlot(slot);
    setOutcome("approved");
    setAnnouncement(t("announceApproved", { slot: slotLabel(slot, intlLocale) }));
  };

  const handleDecline = async () => {
    if (liveData) {
      const res = await respondToChangeRequestAction({
        requestId: liveData.id,
        decision: "decline",
        message: declineReason.trim() || undefined,
      });
      if (!res.ok) {
        setAnnouncement(res.error.message);
        return;
      }
    }
    setOutcome("declined");
    setAnnouncement(t("announceDeclined"));
  };

  const handleCancelBooking = async () => {
    if (liveData) {
      const res = await cancelChangeRequestAction({ requestId: liveData.id });
      if (!res.ok) {
        setAnnouncement(res.error.message);
        return;
      }
    }
    setOutcome("cancelled");
    setAnnouncement(t("announceCancelled"));
  };

  const sendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (liveData) {
      setAnnouncement(t("threadNotAvailable"));
      return;
    }
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, author: perspective, body, at: new Date().toISOString() },
    ]);
    setDraft("");
    setAnnouncement(t("announceSent"));
  };

  const resetDemo = () => {
    setOutcome("pending");
    setApprovedSlot(null);
    setAnnouncement(t("announceReset"));
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Breadcrumb */}
      <nav
        aria-label={t("breadcrumbLabel")}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-muted"
      >
        <Link href="/calendar" className="transition-colors hover:text-electric">
          {t("breadcrumbBookings")}
        </Link>
        <ChevronRight size={12} strokeWidth={2.4} aria-hidden="true" />
        <span aria-current="page" className="text-obsidian">
          {t("changeRequest")} <span className="font-mono">#{ref}</span>
        </span>
      </nav>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-sm bg-warning-tint text-warning"
          >
            <CalendarClock size={24} strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-obsidian sm:text-[28px]">
              {t("changeRequest")}{" "}
              <span className="align-middle font-mono text-[0.6em] font-bold text-muted">
                #{ref}
              </span>
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-obsidian-light">
              {t("askedToMove", {
                requester,
                incumbent,
                date: createdAt.toLocaleDateString(intlLocale, {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </p>
          </div>
        </div>

        {/* Perspective toggle (demo) */}
        <div
          className="segmented"
          role="group"
          aria-label={t("viewAsLabel")}
        >
          <button
            type="button"
            aria-pressed={perspective === "requester"}
            onClick={() => setPerspective("requester")}
            className={`segment ${perspective === "requester" ? "segment-active" : ""}`}
          >
            {t("iAmRequester")}
          </button>
          <button
            type="button"
            aria-pressed={perspective === "incumbent"}
            onClick={() => setPerspective("incumbent")}
            className={`segment ${perspective === "incumbent" ? "segment-active" : ""}`}
          >
            {t("iAmIncumbent")}
          </button>
        </div>
      </div>

      {fallback && changeRequestId !== "demo" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-canvas px-3 py-1.5 text-[11px] font-semibold text-obsidian-light ring-1 ring-border">
          {t("demoFallback", { id: changeRequestId })}
        </p>
      )}

      {/* Two-card layout */}
      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        {/* ============ LEFT — Details ============ */}
        <section
          aria-labelledby="details-heading"
          className="card p-5 sm:p-6 lg:col-span-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="details-heading"
              className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-obsidian-light"
            >
              {t("detailsHeading")}
            </h2>
            <OutcomeChip outcome={outcome} />
          </div>

          {/* New booking card */}
          {newBooking && (
            <BookingSideCard
              tag={t("tagNewBooking")}
              tone="warning"
              booking={newBooking}
              roomName={roomName}
              location={roomLocation ?? undefined}
              clientName={clientNameFor(newBooking)}
              creatorName={liveData?.requesterName ?? null}
            />
          )}

          {/* Connector */}
          <div
            aria-hidden="true"
            className="my-3 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted"
          >
            <span className="h-px flex-1 bg-divider" />
            {t("conflictsWith")}
            <span className="h-px flex-1 bg-divider" />
          </div>

          {/* Incumbent booking card */}
          {oldBooking && (
            <BookingSideCard
              tag={t("tagIncumbent")}
              tone="electric"
              booking={oldBooking}
              roomName={roomName}
              location={roomLocation ?? undefined}
              clientName={clientNameFor(oldBooking)}
              creatorName={liveData?.incumbentName ?? null}
            />
          )}

          {/* Requester message */}
          {cr.message && (
            <figure className="mt-5 flex gap-3 rounded-sm border border-border bg-canvas/60 p-4">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-obsidian text-[11px] font-bold text-white"
              >
                {initials(requester)}
              </span>
              <span className="min-w-0">
                <figcaption className="text-[11px] font-bold text-muted">
                  {t("wroteMessage", { requester })}
                </figcaption>
                <blockquote className="mt-1 text-[13px] leading-snug text-obsidian">
                  {t("messageQuote", { message: cr.message })}
                </blockquote>
              </span>
            </figure>
          )}

          {/* Thread */}
          {messages.length > 1 && (
            <ul role="log" aria-live="polite" className="mt-4 space-y-2">
              {messages.slice(1).map((m) => {
                const author =
                  m.author === "requester" ? requester : incumbent;
                return (
                  <li key={m.id} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-[10px] font-bold text-white ${
                        m.author === "requester" ? "bg-electric" : "bg-obsidian"
                      }`}
                    >
                      {initials(author)}
                    </span>
                    <span className="min-w-0 rounded-sm border border-border bg-white px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                        {author} · {new Date(m.at).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-obsidian">
                        {m.body}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Composer */}
          <form onSubmit={sendMessage} className="mt-4 flex items-center gap-2">
            <label className="sr-only" htmlFor="cr-message">
              {t("addMessageLabel")}
            </label>
            <input
              id="cr-message"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("addMessagePlaceholder")}
              autoComplete="off"
              className="input h-11 flex-1"
            />
            <button
              type="submit"
              aria-label={t("sendMessageLabel")}
              className="btn btn-primary h-11 w-11 !px-0"
            >
              <Send size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>
        </section>

        {/* ============ RIGHT — Status timeline ============ */}
        <section
          aria-labelledby="status-heading"
          className="card flex flex-col p-5 sm:p-6 lg:col-span-2"
        >
          <h2
            id="status-heading"
            className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-obsidian-light"
          >
            {t("statusTimeline")}
          </h2>

          {/* Steps */}
          <ol className="mt-4">
            <TimelineStep
              done
              title={t("stepRequestCreated")}
              detail={`${requester} · ${createdAt.toLocaleDateString(intlLocale, {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}`}
            />
            <TimelineStep
              done={outcome !== "pending"}
              active={outcome === "pending"}
              title={t("stepPendingTitle", { incumbent })}
              detail={t("stepPendingDetail", { hours: TTL_HOURS })}
            />
            <TimelineStep
              done={outcome === "approved"}
              failed={outcome === "declined"}
              muted={outcome === "cancelled" || outcome === "pending"}
              last
              title={
                outcome === "declined"
                  ? t("statusDeclined")
                  : outcome === "cancelled"
                    ? t("stepCancelledByRequester")
                    : t("stepApprovedMoved")
              }
              detail={
                outcome === "approved" && approvedSlot
                  ? slotLabel(approvedSlot, intlLocale)
                  : outcome === "pending"
                    ? t("stepAwaitingIncumbent")
                    : t("stepResolved")
              }
            />
          </ol>

          {/* 72h countdown */}
          {outcome === "pending" && (
            <div className="mt-4 rounded-sm border border-border bg-canvas/60 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-obsidian-light">
                  <Hourglass size={13} strokeWidth={2.2} aria-hidden="true" />
                  {t("countdownWindow", { hours: TTL_HOURS })}
                </span>
                <span
                  className="chip bg-warning-tint text-[11px] font-bold tabular-nums text-[#a34d00]"
                  aria-label={t("timeRemaining", { time: countdown.aria })}
                >
                  {countdown.text}
                </span>
              </div>
              <div
                className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(windowFraction * 100)}
                aria-label={t("progressAria", { hours: TTL_HOURS })}
              >
                <div
                  className="h-full rounded-pill bg-electric transition-[width] duration-500"
                  style={{ width: `${Math.max(3, windowFraction * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* ------- Action area ------- */}
          {outcome === "pending" ? (
            perspective === "incumbent" ? (
              <IncumbentActions
                requester={requester}
                suggestedSlots={cr.suggested_slots}
                declineReason={declineReason}
                setDeclineReason={setDeclineReason}
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            ) : (
              <RequesterActions
                incumbent={incumbent}
                suggestedSlots={cr.suggested_slots}
                onCancel={handleCancelBooking}
              />
            )
          ) : (
            <OutcomePanel
              outcome={outcome}
              approvedSlot={approvedSlot}
              suggestedSlots={cr.suggested_slots}
              declineReason={declineReason}
              roomName={roomName}
              onReset={resetDemo}
            />
          )}
        </section>
      </div>

      {/* aria-live announcements for screen readers */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/* ================ helpers & subcomponents ================ */

function resolveChangeRequest(id: string): ChangeRequestRow {
  // Live mode: fetched server-side in page.tsx and passed down as props.
  // Demo: "demo" (and unknown ids) fall back to cr-1.
  if (id === "demo") return DEMO_CHANGE_REQUESTS[0];
  return DEMO_CHANGE_REQUESTS.find((r) => r.id === id) ?? DEMO_CHANGE_REQUESTS[0];
}

function outcomeFromStatus(status: ChangeRequestRow["status"]): Outcome {
  if (status === "approved") return "approved";
  if (status === "declined") return "declined";
  if (status === "cancelled" || status === "expired") return "cancelled";
  return "pending";
}

function clientNameOf(booking: BookingRow): string | null {
  if (!booking.client_id) return null;
  return DEMO_CLIENTS.find((c) => c.id === booking.client_id)?.full_name ?? null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatCountdown(
  ms: number,
  translate: (key: string, values?: Record<string, string | number>) => string,
): { text: string; aria: string } {
  if (ms <= 0) return { text: translate("countdownExpired"), aria: translate("countdownExpired") };
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (24 * 60));
  const h = Math.floor((totalMin % (24 * 60)) / 60);
  const m = totalMin % 60;
  const text =
    d > 0
      ? translate("countdownDaysHours", { days: d, hours: h })
      : h > 0
        ? translate("countdownHoursMinutes", { hours: h, minutes: m })
        : translate("countdownMinutes", { minutes: m });
  const aria = translate("countdownAria", { days: d, hours: h, minutes: m });
  return { text, aria };
}

function slotLabel(slot: { starts_at: string; ends_at: string }, localeTag?: string): string {
  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at);
  const day = start.toLocaleDateString(localeTag ?? appLocaleTag(), {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
  return `${day} · ${formatTime(start, localeTag ?? appLocaleTag())} – ${formatTime(end, localeTag ?? appLocaleTag())}`;
}

function BookingSideCard({
  tag,
  tone,
  booking,
  roomName,
  location,
  clientName,
  creatorName: creatorNameProp,
}: {
  tag: string;
  tone: "warning" | "electric";
  booking: BookingRow;
  roomName: string;
  location?: string;
  clientName: string | null;
  /** Live display name — falls back to the demo id lookup. */
  creatorName?: string | null;
}) {
  const t = useTranslations("requests");
  const intlLocale = appLocaleTag(useLocale());
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const status =
    booking.status === "pending_conflict"
      ? { label: t("statusPendingConflict"), dot: "bg-warning" }
      : booking.status === "confirmed"
        ? { label: t("statusConfirmed"), dot: "bg-success" }
        : booking.status === "completed"
          ? { label: t("statusCompleted"), dot: "bg-obsidian-light" }
          : { label: t("statusCancelled"), dot: "bg-black/30" };

  const tagClass =
    tone === "warning"
      ? "border-dashed border-warning/70 bg-warning-tint text-[#a34d00]"
      : "border-electric/25 bg-electric-tint text-electric";

  return (
    <article
      className={`mt-4 rounded-md border p-4 ${
        tone === "warning"
          ? "border-warning/40 bg-warning-tint/40"
          : "border-border bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`chip border text-[10px] uppercase tracking-[0.08em] ${tagClass}`}>
          {tag}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-white px-2 py-0.5 text-[10px] font-bold text-obsidian ring-1 ring-border">
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
          {status.label}
        </span>
      </div>
      <h3 className="mt-2.5 text-[15px] font-extrabold leading-snug tracking-[-0.01em] text-obsidian">
        {booking.title}
      </h3>
      <dl className="mt-2.5 grid gap-1.5 text-[12px] font-medium text-obsidian-light sm:grid-cols-2">
        <div className="flex items-center gap-1.5">
          <DoorOpen size={13} strokeWidth={2} className="text-muted" aria-hidden="true" />
          {roomName}
          {location ? <span className="text-muted">· {location}</span> : null}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={13} strokeWidth={2} className="text-muted" aria-hidden="true" />
          {start.toLocaleDateString(appLocaleTag(), { weekday: "short", day: "numeric", month: "short" })}
          {" · "}
          <span className="tabular-nums">
            {formatTime(start)} – {formatTime(end)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={13} strokeWidth={2} className="text-muted" aria-hidden="true" />
          {clientName ?? t("noClient")}
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={13} strokeWidth={2} className="text-muted" aria-hidden="true" />
          {t("createdBy", { name: creatorNameProp ?? creatorName(booking.created_by) })}
        </div>
      </dl>
    </article>
  );
}

function TimelineStep({
  done,
  active,
  failed,
  muted,
  title,
  detail,
  last,
}: {
  done?: boolean;
  active?: boolean;
  failed?: boolean;
  muted?: boolean;
  title: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* connector line */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-[9px] top-[18px] h-[calc(100%-18px)] w-px bg-divider"
        />
      )}
      <span
        aria-hidden="true"
        className={`relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
          failed
            ? "border-error bg-error text-white"
            : done
              ? "border-success bg-success text-white"
              : active
                ? "border-warning bg-warning text-obsidian"
                : "border-border bg-white"
        }`}
      >
        {done && <Check size={11} strokeWidth={3.4} />}
        {active && <span className="h-1.5 w-1.5 rounded-full bg-obsidian" />}
        {failed && <span className="text-[10px] font-black leading-none">×</span>}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[13px] font-bold leading-snug ${
            muted ? "text-muted" : "text-obsidian"
          }`}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium leading-snug text-muted">
          {detail}
        </span>
      </span>
    </li>
  );
}

function OutcomeChip({ outcome }: { outcome: Outcome }) {
  const t = useTranslations("requests");
  const intlLocale = appLocaleTag(useLocale());
  const meta = {
    pending: { label: t("statusPending"), dot: "bg-warning", ring: "ring-warning/40" },
    approved: { label: t("statusApproved"), dot: "bg-success", ring: "ring-success/40" },
    declined: { label: t("statusDeclined"), dot: "bg-error", ring: "ring-error/40" },
    cancelled: { label: t("statusCancelled"), dot: "bg-black/30", ring: "ring-border" },
  }[outcome];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill bg-white px-2.5 py-1 text-[11px] font-bold text-obsidian ring-1 ${meta.ring}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function IncumbentActions({
  requester,
  suggestedSlots,
  declineReason,
  setDeclineReason,
  onApprove,
  onDecline,
}: {
  requester: string;
  suggestedSlots: Array<{ starts_at: string; ends_at: string }>;
  declineReason: string;
  setDeclineReason: (v: string) => void;
  onApprove: (slot: { starts_at: string; ends_at: string }) => void;
  onDecline: () => void;
}) {
  const t = useTranslations("requests");
  const intlLocale = appLocaleTag(useLocale());
  return (
    <div className="mt-5 border-t border-divider pt-4">
      <p className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-obsidian-light">
        {t("incumbentMove")}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted">
        {t("incumbentBody", { requester })}
      </p>

      {/* Suggested slots */}
      <ul className="mt-3 space-y-2">
        {suggestedSlots.map((slot) => (
          <li
            key={slot.starts_at}
            className="flex flex-col gap-2.5 rounded-sm border border-electric/20 bg-electric-tint p-3 sm:flex-row sm:items-center"
          >
            <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-electric">
              <CalendarClock size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{slotLabel(slot, intlLocale)}</span>
            </span>
            <button
              type="button"
              onClick={() => onApprove(slot)}
              className="btn btn-primary h-9 shrink-0 !px-4 !text-[12px]"
            >
              <Check size={14} strokeWidth={3} aria-hidden="true" />
              {t("approveAndMove")}
            </button>
          </li>
        ))}
      </ul>

      {/* Decline */}
      <div className="mt-4">
        <label htmlFor="decline-reason" className="label">
          {t("declineReasonLabel")}
        </label>
        <textarea
          id="decline-reason"
          rows={2}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder={t("declineReasonPlaceholder")}
          className="input min-h-[64px] resize-y py-3"
        />
        <button
          type="button"
          onClick={onDecline}
          className="btn btn-secondary mt-2 h-11 w-full border !border-error/30 text-error hover:!bg-error-tint"
        >
          <XCircle size={17} strokeWidth={2} aria-hidden="true" />
          {t("declineRequest")}
        </button>
      </div>
    </div>
  );
}

function RequesterActions({
  incumbent,
  suggestedSlots,
  onCancel,
}: {
  incumbent: string;
  suggestedSlots: Array<{ starts_at: string; ends_at: string }>;
  onCancel: () => void;
}) {
  const t = useTranslations("requests");
  const intlLocale = appLocaleTag(useLocale());
  return (
    <div className="mt-5 border-t border-divider pt-4">
      <div className="rounded-sm border border-border bg-canvas/60 p-4 text-center">
        <Hourglass size={26} strokeWidth={1.8} className="mx-auto text-warning" aria-hidden="true" />
        <p className="mt-2 text-[14px] font-extrabold text-obsidian">
          {t("waitingOn", { incumbent })}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">
          {t("waitingBody")}
        </p>
      </div>

      <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.1em] text-obsidian-light">
        {t("yourSuggestedSlot")}
      </p>
      <ul className="mt-2 space-y-1.5">
        {suggestedSlots.map((slot) => (
          <li
            key={slot.starts_at}
            className="chip w-full justify-start border border-electric/20 bg-electric-tint px-3 py-2 text-[12px] text-electric"
          >
            <CalendarClock size={14} strokeWidth={2} aria-hidden="true" />
            {slotLabel(slot, intlLocale)}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCancel}
        className="btn btn-secondary mt-4 h-11 w-full border !border-error/30 text-error hover:!bg-error-tint"
      >
        <Ban size={17} strokeWidth={2} aria-hidden="true" />
        {t("cancelMyBooking")}
      </button>
      <Link href="/calendar" className="btn btn-ghost mt-2 h-11 w-full text-obsidian-light">
        {t("backToCalendar")}
        <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
      </Link>
    </div>
  );
}

function OutcomePanel({
  outcome,
  approvedSlot,
  suggestedSlots,
  declineReason,
  roomName,
  onReset,
}: {
  outcome: Outcome;
  approvedSlot: { starts_at: string; ends_at: string } | null;
  suggestedSlots: Array<{ starts_at: string; ends_at: string }>;
  declineReason: string;
  roomName: string;
  onReset: () => void;
}) {
  const t = useTranslations("requests");
  const intlLocale = appLocaleTag(useLocale());
  const slot = approvedSlot ?? suggestedSlots[0] ?? null;

  if (outcome === "approved") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-5 flex-1 rounded-sm border border-success/40 bg-success-tint p-5 text-center"
      >
        <CheckCircle2 size={38} strokeWidth={1.8} className="mx-auto text-success" aria-hidden="true" />
        <p className="mt-2 text-[16px] font-extrabold leading-snug text-obsidian">
          {t("approvedTitle")}
        </p>
        <p className="mt-1.5 text-[12px] leading-snug text-obsidian-light">
          {t.rich("approvedBody", {
            strong: (chunks) => <strong>{chunks}</strong>,
            slot: slot ? slotLabel(slot) : t("theSuggestedSlot"),
            room: roomName,
          })}
        </p>
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/calendar" className="btn btn-primary h-11">
            {t("viewInCalendar")}
            <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
          <button type="button" onClick={onReset} className="btn btn-ghost h-11 text-obsidian-light">
            {t("resetDemo")}
          </button>
        </div>
      </div>
    );
  }

  if (outcome === "declined") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-5 flex-1 rounded-sm border border-error/30 bg-error-tint p-5 text-center"
      >
        <XCircle size={38} strokeWidth={1.8} className="mx-auto text-error" aria-hidden="true" />
        <p className="mt-2 text-[16px] font-extrabold leading-snug text-obsidian">
          {t("declinedTitle")}
        </p>
        <p className="mt-1.5 text-[12px] leading-snug text-obsidian-light">
          {t("declinedBody", { room: roomName })}
          {declineReason.trim() ? (
            <>
              {" "}— “<em>{declineReason.trim()}</em>”
            </>
          ) : (
            t("declinedWithAlternatives")
          )}
          .
        </p>
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/calendar" className="btn btn-primary h-11">
            {t("viewInCalendar")}
            <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
          <button type="button" onClick={onReset} className="btn btn-ghost h-11 text-obsidian-light">
            {t("resetDemo")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-5 flex-1 rounded-sm border border-border bg-canvas/60 p-5 text-center"
    >
      <Ban size={38} strokeWidth={1.8} className="mx-auto text-obsidian-light" aria-hidden="true" />
      <p className="mt-2 text-[16px] font-extrabold leading-snug text-obsidian">
        {t("cancelledTitle")}
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-obsidian-light">
        {t("cancelledBody", { room: roomName })}
      </p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href="/calendar" className="btn btn-primary h-11">
          {t("viewInCalendar")}
          <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </Link>
        <button type="button" onClick={onReset} className="btn btn-ghost h-11 text-obsidian-light">
          {t("resetDemo")}
        </button>
      </div>
    </div>
  );
}
