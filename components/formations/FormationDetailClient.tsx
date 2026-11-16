/**
 * Formation detail: session info + roster management.
 * Demo data (DEMO_FORMATIONS / getDemoParticipants) + local state.
 * Live mode talks to server actions (enrollParticipantAction, markAttendanceAction,
 * importParticipantsAction, removeParticipantAction, setParticipantWaitlistAction, cancelBookingAction).
 * Demo mode keeps sessionStorage persistence as an offline fallback.
 */

"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { appLocaleTag } from "@/lib/intl-locale";
import { createFormationAction, enrollParticipantAction, importParticipantsAction, markAttendanceAction, removeParticipantAction, setParticipantWaitlistAction } from "@/app/actions/formations";
import { cancelBookingAction } from "@/app/actions/bookings";
import Papa from "papaparse";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Copy,
  DoorOpen,
  Download,
  FileUp,
  Info,
  Printer,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";
import {
  DEMO_CLIENTS,
  DEMO_FORMATIONS,
  DEMO_ROOMS,
  getDemoBookings,
  getDemoParticipants,
} from "@/lib/demo-data";
import type { FormationParticipantRow, ParticipantStatus } from "@/lib/types/db";
import {
  EMAIL_RE,
  activeCount,
  effectiveStatus,
  fillPercent,
  formatDuration,
  formatFullDay,
  formatMad,
  formatTimeRange,
  locationBadge,
  roomById,
  stripDemoSuffix,
  waitlistCount,
  type FormationVM,
} from "./model";
import type { FormationListData } from "@/lib/formation-vms";
import { downloadBlob, getFormationsSnapshot, getServerFormationsSnapshot, subscribeFormations } from "./store";
import { duplicateFormation } from "./duplicate";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { FormationStatusChip, StatusChip } from "./StatusChip";
import { ToastViewport, useToast } from "./Toast";

/* Injected print stylesheet: hides app chrome (shell uses <nav>/<header>) and
   expands the roster table to the printable area. Date output stays minimal. */
const PRINT_CSS = `@media print {
  nav, header { display: none !important; }
  .print-hidden { display: none !important; }
  .print-area { display: block !important; overflow: visible !important; }
  .print-only { display: block !important; }
  body { background: var(--color-surface); }
  @page { size: A4; margin: 12mm; }
}`;

const CANCEL_REASONS = [
  "Facilitator unavailable",
  "Room conflict",
  "Client / cohort request",
  "Other",
] as const;

const CANCEL_REASON_KEYS: Record<string, "cancelReasonFacilitator" | "cancelReasonRoomConflict" | "cancelReasonClientRequest" | "cancelReasonOther"> = {
  "Facilitator unavailable": "cancelReasonFacilitator",
  "Room conflict": "cancelReasonRoomConflict",
  "Client / cohort request": "cancelReasonClientRequest",
  Other: "cancelReasonOther",
};

const STATUS_LABEL_KEYS: Record<ParticipantStatus, "participantStatusEnrolled" | "participantStatusConfirmed" | "participantStatusAttended" | "participantStatusNoShow" | "participantStatusCancelled"> = {
  enrolled: "participantStatusEnrolled",
  confirmed: "participantStatusConfirmed",
  attended: "participantStatusAttended",
  no_show: "participantStatusNoShow",
  cancelled: "participantStatusCancelled",
};
const STATUS_OPTIONS = Object.keys(STATUS_LABEL_KEYS) as ParticipantStatus[];

interface CsvRow {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  errors: string[];
  duplicate: boolean;
}

const EMPTY_ENROLL = { name: "", email: "", phone: "", company: "", clientId: "", waitlist: false };

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function resolveFromDemo(id: string): FormationVM | null {
  const formation = DEMO_FORMATIONS.find((f) => f.booking_id === id);
  if (!formation) return null;
  const booking = getDemoBookings().find((b) => b.id === id);
  if (!booking) return null;
  return { booking, formation, participants: getDemoParticipants(id) };
}

/** Stable subscribe for the mounted-flag store. */
const subscribeMounted = () => () => {};

export function FormationDetailClient({
  id,
  data,
}: {
  id: string;
  data?: FormationListData | null;
}) {
  const t = useTranslations("formations");
  const liveVm = data?.vms[0] ?? null;
  const live = data?.live === true;
  // Demo formations render identically on server and client.
  const demoVm = useMemo<FormationVM | null>(() => resolveFromDemo(id), [id]);
  // SSR + first client render see an empty snapshot (skeleton below);
  // after mount, sessionStorage becomes readable for locally created ids.
  const stored = useSyncExternalStore(
    subscribeFormations,
    getFormationsSnapshot,
    getServerFormationsSnapshot,
  );
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
  const localVm = useMemo<FormationVM | null>(() => {
    const hit = stored.find((s) => s.booking.id === id);
    return hit ? { booking: hit.booking, formation: hit.formation, participants: [] } : null;
  }, [id, stored]);

  const vm = liveVm ?? demoVm ?? localVm;
  if (vm)
    return (
      <FormationDetailView
        key={vm.booking.id}
        vm={vm}
        rooms={data?.rooms ?? DEMO_ROOMS}
        clients={data?.clients ?? DEMO_CLIENTS}
        live={live}
      />
    );
  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1440px]" aria-busy="true">
        <div className="h-6 w-56 animate-pulse rounded-pill bg-track" />
        <div className="card mt-4 h-[420px] animate-pulse bg-canvas" />
        <p className="sr-only">{t("loadingFormation")}</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1440px]">
      <nav aria-label={t("breadcrumbLabel")} className="print:hidden flex items-center gap-2 text-[13px] font-semibold">
        <Link href="/formations" className="text-muted transition-colors hover:text-obsidian">
          {t("title")}
        </Link>
        <ChevronRight size={14} aria-hidden="true" className="text-muted" />
        <span aria-current="page" className="text-obsidian">{t("notFound")}</span>
      </nav>
      <div className="card mt-5 flex flex-col items-center px-6 py-20 text-center">
        <NowBarMark size={52} className="opacity-90" />
        <h1 className="mt-5 text-[28px] font-extrabold tracking-[-0.05em] text-obsidian">
          {t("notFoundTitle")}
        </h1>
        <p className="mt-1.5 max-w-md text-[14px] leading-snug text-obsidian-light">
          {t("notFoundBody")}
        </p>
        <Link href="/formations" className="btn btn-primary mt-6 h-11">
          <ArrowLeft size={17} aria-hidden="true" />
          {t("backToFormations")}
        </Link>
      </div>
    </div>
  );
}

function FormationDetailView({
  vm,
  rooms,
  clients,
  live,
}: {
  vm: FormationVM;
  rooms: import("@/lib/types/db").RoomRow[];
  clients: import("@/lib/types/db").ClientRow[];
  live: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("formations");
  const intlLocale = appLocaleTag(useLocale());
  const { toasts, leaving, push, dismiss } = useToast();
  const [participants, setParticipants] = useState<FormationParticipantRow[]>(
    () => vm.participants,
  );

  /* session-cancelled local state */
  const [cancelledReason, setCancelledReason] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
  const isCancelled = vm.formation.status === "cancelled" || cancelledReason !== null;
  const cancelReasonLabel = (reason: string) => t(CANCEL_REASON_KEYS[reason] ?? "cancelReasonOther");

  /* roster search / filters */
  const [rosterQuery, setRosterQuery] = useState("");
  /* Fixed-position "remove?" popover: escapes the table's overflow clip. */
  const [removeTarget, setRemoveTarget] = useState<{ id: string; x: number; y: number; openUpward: boolean } | null>(null);

  const active = activeCount(participants);
  const waitlisted = waitlistCount(participants);
  // Derive from the LIVE roster (not the mount-time snapshot) so chips flip
  // to "Full" the moment capacity is reached.
  const status = isCancelled ? "cancelled" : effectiveStatus({ ...vm, participants });
  const capacity = vm.formation.capacity;
  const left = Math.max(0, capacity - active);
  const pct = fillPercent(vm.formation, participants);
  const room = roomById(vm.booking.room_id, rooms);

  const visible = useMemo(() => {
    const q = rosterQuery.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) =>
      [p.full_name, p.email ?? "", p.company ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [participants, rosterQuery]);

  function patchParticipant(
    participantId: string,
    patch: Partial<FormationParticipantRow>,
  ) {
    setParticipants((current) =>
      current.map((p) => (p.id === participantId ? { ...p, ...patch } : p)),
    );
  }

  /* Escape closes the "remove?" popover. */
  useEffect(() => {
    if (!removeTarget) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setRemoveTarget(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [removeTarget]);

  function requestRemove(event: ReactMouseEvent<HTMLButtonElement>, participantId: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    const openUpward = rect.bottom + 180 > window.innerHeight;
    setRemoveTarget({ id: participantId, x: rect.right, y: openUpward ? rect.top : rect.bottom, openUpward });
  }

  const removeTargetParticipant = removeTarget
    ? (participants.find((p) => p.id === removeTarget.id) ?? null)
    : null;

  async function cycleCheckIn(participant: FormationParticipantRow) {
    if (participant.status === "cancelled") return;
    const next: ParticipantStatus = participant.status === "attended" ? "no_show" : "attended";
    patchParticipant(participant.id, {
      status: next,
      checked_in_at: next === "attended" ? new Date().toISOString() : null,
    });
    if (live) {
      const res = await markAttendanceAction({ participantId: participant.id, status: next });
      if (!res.ok) {
        push(t("toastAttendanceError"), "error");
        router.refresh();
      }
    }
  }

  async function removeParticipant(participantId: string) {
    setParticipants((current) => current.filter((p) => p.id !== participantId));
    setRemoveTarget(null);
    if (live) {
      const res = await removeParticipantAction({ participantId });
      if (!res.ok) {
        push(res.error.message, "error");
        router.refresh();
        return;
      }
      push(t("toastParticipantRemoved"), "info");
      return;
    }
    push(t("toastParticipantRemoved"), "info");
  }

  async function promoteWaitlist(participant: FormationParticipantRow) {
    patchParticipant(participant.id, { waitlist: false });
    if (live) {
      const res = await setParticipantWaitlistAction({ participantId: participant.id, waitlist: false });
      if (!res.ok) {
        push(res.error.message, "error");
        router.refresh();
        return;
      }
      push(t("toastPromoted", { name: participant.full_name }));
      return;
    }
    push(t("toastPromoted", { name: participant.full_name }));
  }

  function markAllPresent() {
    const eligible = participants.filter(
      (p) => (p.status === "enrolled" || p.status === "confirmed") && !p.waitlist,
    );
    if (eligible.length === 0) {
      push(t("toastNothingToMark"), "info");
      return;
    }
    const now = new Date().toISOString();
    if (live) {
      for (const p of eligible) {
        void markAttendanceAction({ participantId: p.id, status: "attended" });
      }
      router.refresh();
    }
    setParticipants((current) =>
      current.map((p) =>
        (p.status === "enrolled" || p.status === "confirmed") && !p.waitlist
          ? { ...p, status: "attended", checked_in_at: p.checked_in_at ?? now }
          : p,
      ),
    );
    push(t("toastMarkedPresent", { count: eligible.length }));
  }

  /* enroll modal */
  const full = left <= 0 && capacity > 0;
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enroll, setEnroll] = useState(EMPTY_ENROLL);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  function openEnroll() {
    // Pre-check waitlist when the session is full (capacity can't change
    // while the modal is open: seats only move through this form).
    setEnroll({ ...EMPTY_ENROLL, waitlist: full });
    setEnrollError(null);
    setEnrollOpen(true);
  }

  function linkClient(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      setEnroll((current) => ({ ...current, clientId }));
      return;
    }
    setEnroll((current) => ({
      ...current,
      clientId,
      name: client.full_name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      company: client.type === "company" ? (client.company ?? client.full_name) : "",
    }));
  }

  async function submitEnroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = enroll.name.trim();
    const email = enroll.email.trim();
    if (!name) return setEnrollError(t("errorFullName"));
    if (!EMAIL_RE.test(email)) return setEnrollError(t("errorEmail"));

    if (live) {
      const res = await enrollParticipantAction({
        bookingId: vm.booking.id,
        fullName: name,
        email,
        phone: enroll.phone.trim() || null,
        company: enroll.company.trim() || null,
        clientId: enroll.clientId || null,
      });
      if (!res.ok) {
        setEnrollError(res.error.message);
        return;
      }
      push(
        res.data.waitlisted
          ? t("toastWaitlistedSessionFull", { name })
          : t("toastEnrolled", { name }),
        res.data.waitlisted ? "info" : "success",
      );
      router.refresh();
      setEnrollOpen(false);
      setEnroll(EMPTY_ENROLL);
      setEnrollError(null);
      return;
    }

    const waitlist = full || enroll.waitlist;
    const participant: FormationParticipantRow = {
      id: `p-local-${Date.now()}`,
      booking_id: vm.booking.id,
      full_name: name,
      email,
      phone: enroll.phone.trim() || null,
      company: enroll.company.trim() || null,
      client_id: enroll.clientId || null,
      status: "enrolled",
      waitlist,
      enrolled_at: new Date().toISOString(),
      checked_in_at: null,
    };
    setParticipants((current) => [...current, participant]);
    push(
      waitlist
        ? t("toastWaitlistedSessionFull", { name })
        : t("toastEnrolled", { name }),
      waitlist ? "info" : "success",
    );
    setEnrollOpen(false);
    setEnroll(EMPTY_ENROLL);
    setEnrollError(null);
  }

  /* CSV import (papaparse, dry run first) */
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  function parseCsv(text: string) {
    setCsvError(null);
    if (!text.trim()) {
      setCsvRows(null);
      return;
    }
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
    });
    const fields = result.meta.fields ?? [];
    const missing = ["full_name", "email"].filter((f) => !fields.includes(f));
    if (missing.length > 0) {
      setCsvRows(null);
      setCsvError(
        t("importMissingColumns", { missing: missing.join(", ") }),
      );
      return;
    }
    const existing = new Set(
      participants.map((p) => (p.email ?? "").trim().toLowerCase()).filter(Boolean),
    );
    const seen = new Set<string>();
    const rows: CsvRow[] = (result.data ?? []).map((raw) => {
      const fullName = (raw.full_name ?? "").trim();
      const email = (raw.email ?? "").trim();
      const phone = (raw.phone ?? "").trim();
      const company = (raw.company ?? "").trim();
      const errors: string[] = [];
      if (!fullName) errors.push(t("csvFullNameRequired"));
      if (!email) errors.push(t("csvEmailRequired"));
      else if (!EMAIL_RE.test(email)) errors.push(t("csvInvalidEmail"));
      const key = email.toLowerCase();
      const duplicate = key !== "" && (existing.has(key) || seen.has(key));
      if (key) seen.add(key);
      return { fullName, email, phone, company, errors, duplicate };
    });
    setCsvRows(rows);
  }

  async function onCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvFileName(file.name);
    setCsvText(text);
    parseCsv(text);
    event.target.value = "";
  }

  function resetImport() {
    setCsvText("");
    setCsvFileName(null);
    setCsvRows(null);
    setCsvError(null);
  }

  const validImportRows = (csvRows ?? []).filter((r) => r.errors.length === 0 && !r.duplicate);
  const duplicateImportCount = (csvRows ?? []).filter((r) => r.duplicate).length;
  const errorImportCount = (csvRows ?? []).filter((r) => r.errors.length > 0).length;

  async function confirmImport() {
    if (validImportRows.length === 0) return;
    if (live) {
      const res = await importParticipantsAction({
        bookingId: vm.booking.id,
        rows: validImportRows.map((r) => ({ full_name: r.fullName, email: r.email, phone: r.phone || null, company: r.company || null })),
      });
      if (!res.ok) {
        push(res.error.message, "error");
        return;
      }
      push(`${t("importEnrolled", { count: res.data.enrolled })}${res.data.skipped ? ` ${t("importSkipped", { skipped: res.data.skipped })}` : ""}`);
      router.refresh();
      setImportOpen(false);
      resetImport();
      return;
    }
    let seats = left;
    const newbies: FormationParticipantRow[] = validImportRows.map((row) => {
      const waitlist = seats <= 0;
      if (!waitlist) seats -= 1;
      return {
        id: `p-local-${Date.now()}-${row.email}`,
        booking_id: vm.booking.id,
        full_name: row.fullName,
        email: row.email,
        phone: row.phone || null,
        company: row.company || null,
        client_id: null,
        status: "enrolled",
        waitlist,
        enrolled_at: new Date().toISOString(),
        checked_in_at: null,
      };
    });
    // TODO(WIRE): bulkEnrollParticipants action: server dedupes + enforces capacity atomically.
    setParticipants((current) => [...current, ...newbies]);
    push(
      `${t("importEnrolled", { count: newbies.length })}${duplicateImportCount ? ` ${t("importSkipped", { skipped: duplicateImportCount })}` : ""}`,
    );
    setImportOpen(false);
    resetImport();
  }

  /* export / print */
  function exportCsv() {
    const header = ["full_name", "email", "phone", "company", "status", "waitlist"];
    const lines = participants.map((p) =>
      [
        p.full_name,
        p.email ?? "",
        p.phone ?? "",
        p.company ?? "",
        p.status,
        p.waitlist ? "yes" : "no",
      ]
        .map(csvEscape)
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    downloadBlob(blob, `roster-${vm.booking.id}.csv`);
    push(t("toastRosterExported"));
  }

  const { booking, formation } = vm;
  const pctColor = pct >= 100 ? "var(--color-error)" : pct >= 80 ? "var(--color-warning)" : "var(--color-success)";

  /* =============== page =============== */

  return (
    <div className="mx-auto max-w-[1440px]">
      <style>{PRINT_CSS}</style>

      {/* Breadcrumb */}
      <nav aria-label={t("breadcrumbLabel")} className="print:hidden flex items-center gap-2 text-[13px] font-semibold">
        <Link href="/formations" className="text-muted transition-colors hover:text-obsidian">
          {t("title")}
        </Link>
        <ChevronRight size={14} aria-hidden="true" className="text-muted" />
        <span aria-current="page" className="max-w-[62ch] truncate text-obsidian" title={booking.title}>
          {booking.title}
        </span>
      </nav>

      {/* Cancellation banner */}
      {isCancelled && (
        <div
          role="alert"
          className="print:hidden mt-4 flex flex-wrap items-start gap-3 rounded-sm border border-error/30 bg-error-tint px-4 py-3 text-[13px] font-semibold text-error-fg"
        >
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p>{t("cancelBannerTitle")}</p>
            <p className="mt-0.5 font-medium text-error-fg/80">{t("cancelBannerReason", { reason: cancelledReason ? cancelReasonLabel(cancelledReason) : t("statusCancelled") })}</p>
          </div>
        </div>
      )}

      {/* Print-only masthead */}
      <div className="print-only hidden border-b border-border pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{t("printMasthead")}</p>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.05em] text-obsidian">{booking.title}</h1>
        <p className="mt-0.5 text-[13px] font-medium text-obsidian-light">
          {formatFullDay(booking.starts_at, intlLocale)} · {formatTimeRange(booking.starts_at, booking.ends_at, intlLocale)} ·{" "}
          {room ? stripDemoSuffix(room.name) : t("roomTbd")} · {t("seatsCount", { count: capacity })}
        </p>
      </div>

      <div className="mt-5 grid items-start gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ============ LEFT: session info ============ */}
        <section className="card min-w-0 p-5 print:hidden sm:p-6" aria-labelledby="session-heading">
          <div className="print:hidden flex flex-wrap items-center gap-2">
            <StatusChip tone="green" className="tracking-[0.08em]">{t("chipFormation")}</StatusChip>
            <FormationStatusChip status={status} seatsLeft={left} />
          </div>

          <h1
            id="session-heading"
            className="print:hidden mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.05em] text-obsidian"
          >
            {booking.title}
          </h1>
          <p className="print:hidden mt-2 text-[14px] leading-snug text-obsidian-light">
            {formation.description?.trim() || t("noDescription")}
          </p>

          {/* Meta grid */}
          <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-divider pt-5 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <CalendarDays size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
              <div>
                <dt className="label mb-0.5">{t("labelDate")}</dt>
                <dd className="text-[13px] font-semibold leading-snug text-obsidian">{formatFullDay(booking.starts_at, intlLocale)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
              <div>
                <dt className="label mb-0.5">{t("labelHours")}</dt>
                <dd className="text-[13px] font-semibold tabular-nums leading-snug text-obsidian">
                  {formatTimeRange(booking.starts_at, booking.ends_at, intlLocale)}{" "}
                  <span className="font-medium text-muted">· {formatDuration(booking.starts_at, booking.ends_at)}</span>
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <DoorOpen size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
              <div>
                <dt className="label mb-0.5">{t("labelRoom")}</dt>
                <dd className="flex flex-wrap items-center gap-2 text-[13px] font-semibold leading-snug text-obsidian">
                  {room ? stripDemoSuffix(room.name) : t("toBeAssigned")}
                  <span className="chip bg-track px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                    {locationBadge(room?.location)}
                  </span>
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Info size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
              <div>
                <dt className="label mb-0.5">{t("labelPricePerSeat")}</dt>
                <dd className="font-mono text-[13px] font-semibold leading-snug text-obsidian">
                  {formation.price_label != null ? formatMad(formation.price_label) : t("priceOnRequest")}
                  {formation.price_label != null && <span className="font-sans text-[11px] font-medium text-muted"> {t("perSeat")}</span>}
                </dd>
              </div>
            </div>

            {/* Capacity: spans both columns with a live progress bar */}
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="label mb-0.5" id="capacity-label">{t("labelCapacity")}</dt>
                <dd className="text-[12px] font-bold tabular-nums text-obsidian-light">
                  {t("capacityFilledPrefix", { active, capacity })} · <span className={left > 0 ? "text-tint-fg-green" : "text-error-fg"}>{t("statusSeatsLeft", { count: left })}</span>
                </dd>
              </div>
              <div
                role="progressbar"
                aria-labelledby="capacity-label"
                aria-valuemin={0}
                aria-valuemax={capacity}
                aria-valuenow={active}
                className="mt-2 h-2.5 w-full overflow-hidden rounded-pill bg-track"
              >
                <div
                  className="h-full rounded-pill transition-all duration-slower"
                  style={{ width: `${pct}%`, background: pctColor }}
                />
              </div>
            </div>
          </dl>

          {/* Actions */}
          <div className="print:hidden mt-5 flex flex-wrap items-center gap-2 border-t border-divider pt-5">
            <button
              type="button"
              onClick={async () => {
                if (live) {
                  const starts = new Date(vm.booking.starts_at);
                  starts.setDate(starts.getDate() + 7);
                  const ends = new Date(vm.booking.ends_at);
                  ends.setDate(ends.getDate() + 7);
                  const res = await createFormationAction({
                    title: vm.booking.title + " (copy)",
                    categoryId: vm.booking.category_id,
                    roomId: vm.booking.room_id,
                    startsAt: starts.toISOString(),
                    endsAt: ends.toISOString(),
                    capacity: vm.formation.capacity,
                    priceLabel: vm.formation.price_label ?? null,
                    description: vm.formation.description ?? null,
                  });
                  if (!res.ok) return push(res.error.message, "error");
                  push(t("toastDuplicateNextWeek"), "success");
                  router.refresh();
                  return;
                }
                const duplicated = duplicateFormation(vm);
                push(t("toastDuplicateDemo", { title: duplicated.booking.title }), "info");
              }}
              className="btn btn-secondary h-11 px-5 text-[13px]"
            >
              <Copy size={16} aria-hidden="true" />
              {t("duplicate")}
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              disabled={isCancelled}
              className="btn h-11 border border-error/30 bg-error-tint px-5 text-[13px] font-bold text-error-fg transition-colors hover:border-error/50 hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AlertTriangle size={16} aria-hidden="true" />
              {isCancelled ? t("cancelledButton") : t("cancelSessionLabel")}
            </button>
          </div>
        </section>

        {/* ============ RIGHT: roster ============ */}
        <section className="card min-w-0 p-5 sm:p-6 print:rounded-none print:border-0 print:p-0 print:shadow-none" aria-labelledby="roster-heading">
          <div className="print:hidden flex flex-wrap items-center gap-2.5">
            <h2 id="roster-heading" className="text-[17px] font-extrabold tracking-[-0.02em] text-obsidian">
              {t("participants")}
            </h2>
            <span aria-live="polite" className="flex flex-wrap items-center gap-2">
              <span className="chip bg-tint-blue tabular-nums text-tint-fg-blue">{t("chipEnrolled", { count: active })}</span>
              <span className={`chip tabular-nums ${left > 0 ? "bg-success-tint text-tint-fg-green" : "bg-error-tint text-error-fg"}`}>
                {t("statusSeatsLeft", { count: left })}
              </span>
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <label htmlFor="roster-search" className="sr-only">{t("searchParticipantsLabel")}</label>
                <input
                  id="roster-search"
                  type="search"
                  value={rosterQuery}
                  onChange={(e) => setRosterQuery(e.target.value)}
                  placeholder={t("searchRosterPlaceholder")}
                  className="input h-10 w-36 pl-9 text-[13px] sm:w-44"
                />
              </div>
              <button type="button" onClick={openEnroll} className="btn btn-primary h-10 px-4 text-[13px]">
                <UserPlus size={16} aria-hidden="true" />
                {t("enroll")}
              </button>
            </div>
          </div>

          {/* Secondary actions */}
          <div className="print:hidden mt-3 flex flex-wrap items-center gap-2 border-b border-divider pb-4">
            <button type="button" onClick={() => setImportOpen(true)} className="btn btn-secondary h-9 px-4 text-[12px]">
              <FileUp size={15} aria-hidden="true" />
              {t("importCsv")}
            </button>
            <button type="button" onClick={markAllPresent} className="btn btn-secondary h-9 px-4 text-[12px]">
              <CheckCheck size={15} aria-hidden="true" />
              {t("markAllPresent")}
            </button>
            <button type="button" onClick={exportCsv} className="btn btn-secondary h-9 px-4 text-[12px]">
              <Download size={15} aria-hidden="true" />
              {t("exportCsv")}
            </button>
            <button type="button" onClick={() => window.print()} className="btn btn-secondary h-9 px-4 text-[12px]">
              <Printer size={15} aria-hidden="true" />
              {t("printRoster")}
            </button>
            {waitlisted > 0 && (
              <span className="chip bg-tint-amber text-tint-fg-amber tabular-nums">{t("chipWaitlisted", { count: waitlisted })}</span>
            )}
          </div>

          {/* Roster table (desktop + print) */}
          {visible.length > 0 ? (
            <>
              <div className="print-area mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                      <th scope="col" className="w-10 pb-2.5 pr-2">#</th>
                      <th scope="col" className="pb-2.5 pr-3">{t("colName")}</th>
                      <th scope="col" className="pb-2.5 pr-3">{t("colContact")}</th>
                      <th scope="col" className="pb-2.5 pr-3">{t("colStatus")}</th>
                      <th scope="col" className="pb-2.5 pr-3">{t("colWaitlist")}</th>
                      <th scope="col" className="pb-2.5 pr-3">{t("colCheckIn")}</th>
                      <th scope="col" className="w-14 pb-2.5 text-right"><span className="sr-only">{t("colActions")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p, index) => (
                      <tr key={p.id} className="border-b border-divider align-middle last:border-0">
                        <td className="py-2.5 pr-2 tabular-nums text-muted">{index + 1}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={p.full_name} size={32} />
                            <span className="min-w-0">
                              <span title={p.full_name} className="block truncate font-semibold leading-tight text-obsidian">{p.full_name}</span>
                              {p.company && <span title={p.company} className="block truncate text-[11px] font-medium text-muted">{p.company}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="block max-w-[200px] truncate text-[12px] font-medium text-obsidian-light" title={p.email ?? undefined}>
                            {p.email ?? "—"}
                          </span>
                          <span className="block text-[11px] tabular-nums text-muted">{p.phone ?? ""}</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <label className="sr-only" htmlFor={`status-${p.id}`}>
                            {t("statusFor", { name: p.full_name })}
                          </label>
                          <select
                            id={`status-${p.id}`}
                            value={p.status}
                            onChange={(e) =>
                              patchParticipant(p.id, {
                                status: e.target.value as ParticipantStatus,
                                checked_in_at:
                                  e.target.value === "attended"
                                    ? (p.checked_in_at ?? new Date().toISOString())
                                    : null,
                              })
                            }
                            className="input h-9 w-[126px] px-2 text-[12px] font-semibold"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{t(STATUS_LABEL_KEYS[s])}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pr-3">
                          {p.waitlist ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <StatusChip tone="amber">{t("waitlistChip")}</StatusChip>
                              <button
                                type="button"
                                onClick={() => promoteWaitlist(p)}
                                className="text-[11px] font-bold text-electric underline-offset-2 hover:underline"
                              >
                                {t("promote")}
                              </button>
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <button
                            type="button"
                            disabled={p.status === "cancelled"}
                            aria-pressed={p.status === "attended"}
                            aria-label={t("toggleAttendance", { name: p.full_name })}
                            onClick={() => cycleCheckIn(p)}
                            className={`inline-flex h-8 w-[104px] items-center justify-center gap-1.5 rounded-pill text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              p.status === "attended"
                                ? "bg-success-tint text-tint-fg-green"
                                : p.status === "no_show"
                                  ? "bg-error-tint text-error-fg"
                                  : "bg-track text-obsidian-light hover:bg-hover-fill hover:text-obsidian"
                            }`}
                          >
                            {p.status === "attended" ? (
                              <><Check size={13} strokeWidth={2.4} aria-hidden="true" />{t("checkInAttended")}</>
                            ) : p.status === "no_show" ? (
                              <><X size={13} strokeWidth={2.4} aria-hidden="true" />{t("checkInNoShow")}</>
                            ) : (
                              <><UserCheck size={13} aria-hidden="true" />{t("checkIn")}</>
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            aria-label={t("removeFromRoster", { name: p.full_name })}
                            aria-haspopup="dialog"
                            aria-expanded={removeTarget?.id === p.id}
                            onClick={(event) => requestRemove(event, p.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-error-tint hover:text-error-fg"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="print:hidden mt-4 space-y-3 md:hidden">
                {visible.map((p, index) => (
                  <li key={p.id} className="rounded-sm border border-border bg-canvas p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-muted">{index + 1}</span>
                      <Avatar name={p.full_name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p title={p.full_name} className="truncate text-[13px] font-bold leading-tight text-obsidian">{p.full_name}</p>
                        {p.company && <p title={p.company} className="truncate text-[11px] font-medium text-muted">{p.company}</p>}
                        <p className="mt-1 truncate text-[11px] text-obsidian-light" title={`${p.email ?? "—"}${p.phone ? " · " + p.phone : ""}`}>{p.email ?? "—"}{p.phone ? ` · ${p.phone}` : ""}</p>
                      </div>
                      {p.waitlist && <StatusChip tone="amber" className="shrink-0">{t("waitlistChip")}</StatusChip>}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[52px]">
                      <label className="sr-only" htmlFor={`m-status-${p.id}`}>{t("statusFor", { name: p.full_name })}</label>
                      <select
                        id={`m-status-${p.id}`}
                        value={p.status}
                        onChange={(e) =>
                          patchParticipant(p.id, {
                            status: e.target.value as ParticipantStatus,
                            checked_in_at: e.target.value === "attended" ? new Date().toISOString() : null,
                          })
                        }
                        className="input h-9 flex-1 min-w-[120px] px-2 text-[12px] font-semibold"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{t(STATUS_LABEL_KEYS[s])}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={p.status === "cancelled"}
                        aria-pressed={p.status === "attended"}
                        aria-label={t("toggleAttendance", { name: p.full_name })}
                        onClick={() => cycleCheckIn(p)}
                        className={`inline-flex h-9 w-[104px] items-center justify-center gap-1.5 rounded-pill text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                          p.status === "attended"
                            ? "bg-success-tint text-tint-fg-green"
                            : p.status === "no_show"
                              ? "bg-error-tint text-error-fg"
                              : "bg-track text-obsidian-light"
                        }`}
                      >
                        {p.status === "attended" ? (
                          <><Check size={13} strokeWidth={2.4} aria-hidden="true" />{t("checkInAttended")}</>
                        ) : p.status === "no_show" ? (
                          <><X size={13} strokeWidth={2.4} aria-hidden="true" />{t("checkInNoShow")}</>
                        ) : (
                          <><UserCheck size={13} aria-hidden="true" />{t("checkIn")}</>
                        )}
                      </button>
                      {p.waitlist && (
                        <button type="button" onClick={() => promoteWaitlist(p)} className="text-[11px] font-bold text-electric hover:underline">
                          {t("promote")}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={t("removeFromRoster", { name: p.full_name })}
                        aria-haspopup="dialog"
                        onClick={(event) => requestRemove(event, p.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-pill text-muted hover:bg-error-tint hover:text-error-fg"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="print:hidden mt-6 flex flex-col items-center gap-3 px-4 py-10 text-center">
              <Users size={30} aria-hidden="true" className="text-muted" strokeWidth={1.8} />
              {rosterQuery.trim() ? (
                <>
                  <p className="text-[15px] font-bold text-obsidian">{t("noParticipantsMatch", { query: rosterQuery.trim() })}</p>
                  <button type="button" onClick={() => setRosterQuery("")} className="btn btn-secondary h-9 px-4 text-[13px]">
                    {t("clearSearch")}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-bold text-obsidian">{t("noParticipantsYet")}</p>
                  <p className="max-w-sm text-[13px] leading-snug text-obsidian-light">
                    {t("noParticipantsBody")}
                  </p>
                  <button type="button" onClick={openEnroll} className="btn btn-primary h-10 px-5 text-[13px]">
                    <UserPlus size={16} aria-hidden="true" />
                    {t("enrollFirst")}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ============ Enroll modal ============ */}
      {enrollOpen && (
        <Modal
          title={t("enrollTitle")}
          description={full ? t("enrollDescFull") : t("enrollDescOpen")}
          onClose={() => setEnrollOpen(false)}
        >
          <form onSubmit={submitEnroll} noValidate className="grid gap-4">
            {full && (
              <div role="status" className="rounded-sm border border-warning/30 bg-warning-tint px-4 py-2.5 text-[12px] font-semibold leading-snug text-tint-fg-amber">
                {t("sessionFullNote", { capacity })}
              </div>
            )}
            <div>
              <label htmlFor="en-client" className="label">{t("linkClient")} <span className="font-medium normal-case text-muted">{t("optionalParen")}</span></label>
              <select id="en-client" value={enroll.clientId} onChange={(e) => linkClient(e.target.value)} className="input">
                <option value="">{t("noLinkedClient")}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}{client.company && client.company !== client.full_name ? `: ${client.company}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="en-name" className="label">{t("fullNameRequired")}</label>
                <input
                  id="en-name"
                  type="text"
                  value={enroll.name}
                  onChange={(e) => { setEnroll({ ...enroll, name: e.target.value }); setEnrollError(null); }}
                  placeholder="Salma Bennani"
                  className="input"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="en-email" className="label">{t("emailRequired")}</label>
                <input
                  id="en-email"
                  type="email"
                  value={enroll.email}
                  onChange={(e) => { setEnroll({ ...enroll, email: e.target.value }); setEnrollError(null); }}
                  placeholder="name@company.ma"
                  className="input"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="en-phone" className="label">{t("labelPhone")}</label>
                <input
                  id="en-phone"
                  type="tel"
                  value={enroll.phone}
                  onChange={(e) => setEnroll({ ...enroll, phone: e.target.value })}
                  placeholder="+212 6 00 00 00 00"
                  className="input"
                  autoComplete="off"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="en-company" className="label">{t("labelCompany")}</label>
                <input
                  id="en-company"
                  type="text"
                  value={enroll.company}
                  onChange={(e) => setEnroll({ ...enroll, company: e.target.value })}
                  placeholder="Acme SARL"
                  className="input"
                  autoComplete="off"
                />
              </div>
            </div>
            <label className="flex items-start gap-2.5 rounded-sm border border-border bg-canvas px-4 py-3">
              <input
                type="checkbox"
                checked={full ? true : enroll.waitlist}
                disabled={full}
                onChange={(e) => setEnroll({ ...enroll, waitlist: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--color-electric)]"
              />
              <span className="text-[13px] font-medium leading-snug text-obsidian-light">
                <span className="font-bold text-obsidian">{t("addToWaitlist")}</span>
                {full ? t("waitlistRequiredSuffix") : t("waitlistAutoSuffix")}
              </span>
            </label>
            {enrollError && (
              <p role="alert" className="rounded-sm border border-error/30 bg-error-tint px-4 py-2.5 text-[13px] font-semibold text-error-fg">
                {enrollError}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-divider pt-4">
              <button type="button" onClick={() => setEnrollOpen(false)} className="btn btn-ghost h-11 px-5 text-[14px]">
                {t("cancel")}
              </button>
              <button type="submit" className="btn btn-primary h-11">
                {full || enroll.waitlist ? <Users size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
                {full || enroll.waitlist ? t("addToWaitlist") : t("enrollParticipant")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ CSV import modal (dry run) ============ */}
      {importOpen && (
        <Modal
          title={t("importTitle")}
          description={t("importDescription")}
          onClose={() => { setImportOpen(false); resetImport(); }}
          size="lg"
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn btn-secondary h-10 cursor-pointer px-4 text-[13px]">
              <FileUp size={16} aria-hidden="true" />
              {t("chooseCsvFile")}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onCsvFile} />
            </label>
            {csvFileName && (
              <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-obsidian-light">
                {csvFileName}
                <button type="button" onClick={resetImport} aria-label={t("clearImportedFile")} className="rounded-pill p-1 text-muted hover:text-obsidian">
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>

          <div className="mt-3">
            <label htmlFor="csv-paste" className="label">{t("orPasteCsv")}</label>
            <textarea
              id="csv-paste"
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setCsvFileName(null); parseCsv(e.target.value); }}
              placeholder={"full_name,email,phone,company\nSalma Bennani,salma@example.com,+212 661 000 000,Acme SARL"}
              rows={4}
              spellCheck={false}
              className="input h-auto min-h-[92px] py-3 font-mono text-[12px] leading-relaxed"
            />
          </div>

          {csvError && (
            <p role="alert" className="mt-3 rounded-sm border border-error/30 bg-error-tint px-4 py-2.5 text-[13px] font-semibold text-error-fg">
              {csvError}
            </p>
          )}

          {csvRows && csvRows.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
                  {t("previewTitle", { count: csvRows.length })}
                </p>
                <p aria-live="polite" className="text-[12px] font-semibold text-obsidian-light">
                  <span className="text-tint-fg-green">{t("previewReady", { count: validImportRows.length })}</span>
                  {duplicateImportCount > 0 && <> · <span className="text-tint-fg-amber">{t("previewDuplicates", { count: duplicateImportCount })}</span></>}
                  {errorImportCount > 0 && <> · <span className="text-error-fg">{t("previewErrors", { count: errorImportCount })}</span></>}
                </p>
              </div>
              <div className="mt-2 max-h-64 overflow-auto rounded-sm border border-border">
                <table className="w-full border-collapse text-left text-[12px]">
                  <thead className="sticky top-0 bg-canvas">
                    <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                      <th scope="col" className="px-3 py-2">#</th>
                      <th scope="col" className="px-3 py-2">{t("colFullName")}</th>
                      <th scope="col" className="px-3 py-2">{t("colEmail")}</th>
                      <th scope="col" className="px-3 py-2">{t("colCompany")}</th>
                      <th scope="col" className="px-3 py-2">{t("colRowResult")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, index) => (
                      <tr key={index} className="border-t border-divider align-top">
                        <td className="px-3 py-2 tabular-nums text-muted">{index + 1}</td>
                        <td className="px-3 py-2 font-semibold text-obsidian">{row.fullName || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2 text-obsidian-light">{row.email || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2 text-obsidian-light">{row.company || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="font-semibold text-error-fg">{row.errors.join("; ")}</span>
                          ) : row.duplicate ? (
                            <span className="font-semibold text-tint-fg-amber">{t("rowDuplicate")}</span>
                          ) : (
                            <span className="font-semibold text-tint-fg-green">{t("rowOk")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
            <p className="flex items-center gap-2 text-[12px] font-medium text-muted">
              <Info size={14} aria-hidden="true" />
              {t("importFooterNote")}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setImportOpen(false); resetImport(); }} className="btn btn-ghost h-11 px-5 text-[14px]">
                {t("cancel")}
              </button>
              <button type="button" onClick={confirmImport} disabled={validImportRows.length === 0} className="btn btn-primary h-11 disabled:cursor-not-allowed disabled:opacity-50">
                <Check size={17} aria-hidden="true" />
                {t("confirmImport", { count: validImportRows.length })}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ Cancel session modal ============ */}
      {cancelOpen && (
        <Modal
          title={t("cancelSessionTitle")}
          description={t("cancelSessionDescription")}
          onClose={() => setCancelOpen(false)}
        >
          <label htmlFor="cancel-reason" className="label">{t("cancelReasonLabel")}</label>
          <select id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="input">
            {CANCEL_REASONS.map((reason) => (
              <option key={reason} value={reason}>{cancelReasonLabel(reason)}</option>
            ))}
          </select>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-divider pt-4">
            <button type="button" onClick={() => setCancelOpen(false)} className="btn btn-ghost h-11 px-5 text-[14px]">
              {t("keepSession")}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (live) {
                  const res = await cancelBookingAction({ bookingId: vm.booking.id, reason: cancelReason });
                  if (!res.ok) return push(res.error.message, "error");
                }
                setCancelledReason(cancelReason);
                setCancelOpen(false);
                push(t("toastSessionCancelled"), "error");
                if (live) router.refresh();
              }}
              className="btn h-11 bg-error px-6 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <AlertTriangle size={16} aria-hidden="true" />
              {t("cancelSessionConfirm")}
            </button>
          </div>
        </Modal>
      )}

      {/* ============ Remove-participant popover (shared by table + mobile cards) ============ */}
      {removeTarget && removeTargetParticipant && (
        <>
          <button
            type="button"
            aria-label={t("dismiss")}
            onClick={() => setRemoveTarget(null)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="alertdialog"
            aria-label={t("removeParticipantTitle", { name: removeTargetParticipant.full_name })}
            className="fixed z-20 w-60 rounded-sm border border-border bg-white p-3 text-left shadow-lg"
            style={{
              top: removeTarget.openUpward ? removeTarget.y - 156 : removeTarget.y + 8,
              left: Math.max(8, removeTarget.x - 240),
            }}
          >
            <p className="text-[13px] font-bold text-obsidian">{t("removeParticipantQuestion")}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">
              {t("removeParticipantBody", { name: removeTargetParticipant.full_name })}
            </p>
            <div className="mt-2.5 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="btn btn-ghost h-8 px-3 text-[12px]"
              >
                {t("keep")}
              </button>
              <button
                type="button"
                onClick={() => removeParticipant(removeTargetParticipant.id)}
                className="h-8 rounded-pill bg-error px-3 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
              >
                {t("remove")}
              </button>
            </div>
          </div>
        </>
      )}

      <ToastViewport toasts={toasts} leaving={leaving} onDismiss={dismiss} />
    </div>
  );
}
