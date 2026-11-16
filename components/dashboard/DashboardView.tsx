import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  BarChart3,
  BellRing,
  CalendarDays,
  GraduationCap,
  Plus,
  TrendingUp,
  Users,
  ChevronRight,
  DoorOpen,
  Zap,
} from "lucide-react";
import { NowBarMark, Wordmark } from "@/components/brand/NowBar";
import type { DashboardData } from "@/lib/dashboard-live";

/* demo fallback (fresh clone, no Supabase) */
const DEMO = {
  todayLong: "Friday, 13 November 2026",
  firstName: "Marouane",
  kpis: { todayBookings: 9, weekUtilization: 68, formationFillRate: 81, pendingChangeRequests: 2 },
  grid: {
    rooms: [
      { id: "room-1", name: "Salle Grande", location: "Casablanca" },
      { id: "room-2", name: "Salle Petite", location: "Agadir" },
      { id: "room-3", name: "Salle Formation", location: "Casablanca" },
    ] as Array<{ id: string; name: string; location: string }>,
    days: [
      { label: "Mon", date: 9, isToday: false, weekend: false },
      { label: "Tue", date: 10, isToday: false, weekend: false },
      { label: "Wed", date: 11, isToday: false, weekend: false },
      { label: "Thu", date: 12, isToday: false, weekend: false },
      { label: "Fri", date: 13, isToday: true, weekend: false },
      { label: "Sat", date: 14, isToday: false, weekend: true },
      { label: "Sun", date: 15, isToday: false, weekend: true },
    ],
    events: [
      { day: 0, roomId: "room-1", time: "09:30", title: "Acme SARL: Board", tone: "blue" as const },
      { day: 0, roomId: "room-3", time: "14:00", title: "React Avancé S3", tone: "green" as const },
      { day: 1, roomId: "room-2", time: "10:00", title: "Interview: Stagiaire", tone: "purple" as const },
      { day: 1, roomId: "room-1", time: "15:30", title: "ONCF: Réservation", tone: "blue" as const },
      { day: 2, roomId: "room-3", time: "09:00", title: "Formation Agile S1", tone: "green" as const },
      { day: 2, roomId: "room-1", time: "13:00", title: "Marjane: Comité", tone: "blue" as const },
      { day: 3, roomId: "room-2", time: "11:30", title: "Client call: Attijariwafa", tone: "purple" as const },
      { day: 3, roomId: "room-3", time: "16:00", title: "React Avancé S4 · waitlist", tone: "amber" as const },
      { day: 4, roomId: "room-1", time: "09:00", title: "Install: équipe", tone: "purple" as const },
      { day: 5, roomId: "room-2", time: "10:30", title: "Coworking: libre", tone: "blue" as const },
    ],
  },
  futureEvents: [
    { day: "Today", time: "14:00 – 16:00", title: "React Avancé: Session 3", meta: "Formation · 14/20 seats", chip: "Today" },
    { day: "Today", time: "17:30 – 18:15", title: "Revue produit: Équipe", meta: "Internal", chip: "Today" },
    { day: "Tomorrow", time: "09:30 – 13:00", title: "Formation Agile: Module 1", meta: "Salle Formation · 18/20 seats", chip: "Tomorrow" },
  ],
  plansInFlight: [
    { title: "Open Salle Formation: March", tasks: "4/6 tasks", pct: 67 },
    { title: "Agadir second location", tasks: "2/5 tasks", pct: 40 },
    { title: "Website + booking funnel", tasks: "5/8 tasks", pct: 62 },
  ],
  utilization: [
    { room: "Salle Formation", pct: 84 },
    { room: "Salle Grande", pct: 66 },
    { room: "Salle Petite", pct: 52 },
  ],
};

const PILL: Record<string, string> = {
  blue: "bg-tint-blue text-tint-fg-blue",
  green: "bg-tint-green text-tint-fg-green",
  purple: "bg-tint-purple text-tint-fg-purple",
  amber: "bg-warning-tint text-tint-fg-amber border border-dashed border-warning/50",
};

const hatch = {
  backgroundImage:
    "repeating-linear-gradient(-45deg, rgba(0,0,0,0.035) 0 6px, transparent 6px 12px)",
};

/* view */
export function DashboardView({ data }: { data?: DashboardData | null }) {
  const t = useTranslations("dashboard");
  // When live data exists, use it: otherwise the demo set above.
  const todayLong = data?.todayLong ?? DEMO.todayLong;
  const firstName = data?.firstName ?? DEMO.firstName;
  const kpis = data?.kpis ?? DEMO.kpis;
  const rooms = (data?.grid.rooms ?? DEMO.grid.rooms).map((r) => ({ id: r.id, name: r.name, location: r.location }));
  const days = data?.grid.days ?? DEMO.grid.days;
  const events = data?.grid.events ?? DEMO.grid.events;
  const futureEvents = data?.futureEvents ?? DEMO.futureEvents;
  const plansInFlight = data?.plansInFlight ?? DEMO.plansInFlight;
  const utilization = data?.utilization ?? DEMO.utilization;

  const kpiTiles = [
    { label: t("kpiTodayBookings"), value: String(kpis.todayBookings), delta: t("deltaLive"), up: true, tint: "bg-tint-blue text-electric" },
    { label: t("kpiWeekUtilization"), value: `${kpis.weekUtilization}%`, delta: t("deltaBookedHours"), up: true, tint: "bg-tint-green text-tint-fg-green" },
    { label: t("kpiFormationFillRate"), value: `${kpis.formationFillRate}%`, delta: t("deltaEnrolledSeats"), up: true, tint: "bg-tint-purple text-tint-fg-purple" },
    { label: t("kpiPendingChangeRequests"), value: String(kpis.pendingChangeRequests), delta: kpis.pendingChangeRequests > 0 ? t("deltaAwaitingResponse") : t("deltaNothingPending"), up: false, tint: "bg-warning-tint text-tint-fg-amber" },
  ];

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.05em] text-obsidian sm:text-[32px]">
            {t("greeting", { firstName })}
          </h1>
          <p className="mt-1 text-[14px] font-medium text-obsidian-light">{t("headerMeta", { today: todayLong })}</p>
        </div>
        <Link href="/calendar" className="btn btn-primary h-11 shadow-electric">
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
          {t("newBooking")}
        </Link>
      </div>

      {/* KPI row */}
      <section aria-label={t("keyMetricsLabel")} className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpiTiles.map((kpi) => (
          <div key={kpi.label} className="card p-4 sm:p-5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-sm ${kpi.tint}`}>
              <TrendingUp size={17} strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{kpi.label}</p>
            <p className="mt-0.5 font-mono text-[26px] font-extrabold leading-none tracking-[-0.05em] text-obsidian tabular-nums">{kpi.value}</p>
            <p className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${kpi.up ? "text-tint-fg-green" : "text-tint-fg-amber"}`}>
              {kpi.up ? <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" /> : <BellRing size={12} strokeWidth={2.2} aria-hidden="true" />}
              {kpi.delta}
            </p>
          </div>
        ))}
      </section>

      {/* Hero: schedule grid + right rail */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        {/* Schedule grid card */}
        <section aria-label={t("thisWeekLabel")} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider p-4 sm:p-5">
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-obsidian">{t("thisWeekRooms")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-tint-green text-tint-fg-green">{t("chipFormation")}</span>
              <span className="chip bg-tint-blue text-tint-fg-blue">{t("chipRoomRental")}</span>
              <span className="chip bg-tint-purple text-tint-fg-purple">{t("chipInternal")}</span>
              <span className="chip border border-dashed border-warning/60 bg-warning-tint text-tint-fg-amber">{t("chipPending")}</span>
            </div>
          </div>

          {/* Day strip */}
          <div className="grid grid-cols-7 gap-1.5 overflow-x-auto border-b border-divider p-3 sm:gap-2 sm:p-4">
            {days.map((d, i) => {
              const today = d.isToday;
              const weekend = d.weekend;
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center rounded-md border px-1 py-2 ${
                    today
                      ? "border-electric bg-electric text-white shadow-electric"
                      : weekend
                        ? "border-border bg-canvas/60 text-obsidian-light"
                        : "border-border bg-white text-obsidian"
                  }`}
                >
                  <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${today ? "text-white/85" : "text-muted"}`}>
                    {d.label}
                  </span>
                  <span className="mt-0.5 text-[17px] font-extrabold leading-none">{d.date}</span>
                </div>
              );
            })}
          </div>

          {/* Rooms × days grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[760px] p-3 sm:p-4">
              {rooms.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
                  <p className="text-[14px] font-bold text-obsidian">{t("noRoomsTitle")}</p>
                  <p className="mt-1 text-[12px] font-medium text-muted">{t("noRoomsBody")}</p>
                  <Link href="/settings/rooms" className="btn btn-secondary mt-4 h-10 text-[13px]">{t("addRooms")}</Link>
                </div>
              ) : (
                rooms.map((room) => (
                  <div key={room.id} className="grid grid-cols-[150px_repeat(7,1fr)] gap-1.5 border-b border-divider py-2 last:border-0">
                    <div className="flex flex-col justify-center pr-2">
                      <span className="text-[12px] font-bold leading-tight text-obsidian">{room.name}</span>
                      <span className="text-[11px] font-medium text-muted">{room.location}</span>
                    </div>
                    {days.map((d, dayIdx) => {
                      const weekend = d.weekend;
                      const cellEvents = events.filter((e) => e.day === dayIdx && e.roomId === room.id);
                      const isTodayCol = d.isToday;
                      return (
                        <div
                          key={dayIdx}
                          style={weekend ? hatch : undefined}
                          className={`relative min-h-[64px] rounded-sm border p-1 ${
                            isTodayCol ? "border-electric/35 bg-electric-tint/40" : "border-divider"
                          }`}
                        >
                          {isTodayCol && (
                            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t-2 border-electric/60">
                              <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-electric" />
                            </div>
                          )}
                          <div className="flex flex-col gap-1">
                            {cellEvents.map((e, i) => (
                              <div
                                key={i}
                                title={`${e.time}: ${e.title}`}
                                className={`truncate rounded-xs px-1.5 py-1 text-[10px] font-semibold leading-tight ${PILL[e.tone] ?? PILL.blue}`}
                              >
                                <span className="font-bold">{e.time}</span> {e.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-divider px-4 py-3">
            <p className="text-[11px] font-medium text-muted">
              {data ? t("dataLiveFromDb") : t("dataPreviewDemo")}
            </p>
            <Link href="/calendar" className="inline-flex items-center gap-1 text-[12px] font-bold text-electric hover:text-electric-hover">
              {t("openCalendar")} <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          {/* Welcome card */}
          <section aria-label={t("welcomeLabel")} className="card relative overflow-hidden p-5">
            <div className="absolute -right-6 -top-6 opacity-[0.07]" aria-hidden="true">
              <NowBarMark size={150} />
            </div>
            <div className="relative">
              <NowBarMark size={36} />
              <h2 className="mt-3 text-[20px] font-extrabold leading-tight tracking-[-0.05em] text-obsidian">
                {t("welcomeBack")}
                <br />
                {firstName}
              </h2>
              <p className="mt-1.5 text-[13px] font-medium text-obsidian-light">
                {t("summaryLine", { bookings: kpis.todayBookings, plans: plansInFlight.length, requests: kpis.pendingChangeRequests })}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/calendar" className="btn btn-primary h-10 w-full gap-1.5 text-[12px]">
                  <Plus size={15} strokeWidth={2.4} aria-hidden="true" /> {t("quickBooking")}
                </Link>
                <Link href="/formations" className="btn btn-secondary h-10 w-full gap-1.5 border border-border bg-white text-[12px]">
                  <GraduationCap size={15} strokeWidth={2} aria-hidden="true" /> {t("quickFormation")}
                </Link>
                <Link href="/clients" className="btn btn-secondary h-10 w-full gap-1.5 border border-border bg-white text-[12px]">
                  <Users size={15} strokeWidth={2} aria-hidden="true" /> {t("quickClient")}
                </Link>
                <Link href="/plans" className="btn btn-secondary h-10 w-full gap-1.5 border border-border bg-white text-[12px]">
                  <Zap size={15} strokeWidth={2} aria-hidden="true" /> {t("quickPlan")}
                </Link>
              </div>
            </div>
          </section>

          {/* Pending change requests */}
          <section aria-label={t("pendingChangeRequestsLabel")} className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-obsidian">{t("changeRequestsTitle")}</h3>
              <span className={`chip ${kpis.pendingChangeRequests > 0 ? "bg-warning-tint font-bold text-tint-fg-amber" : "bg-success-tint text-tint-fg-green"}`}>
                {kpis.pendingChangeRequests > 0 ? t("chipPendingCount", { count: kpis.pendingChangeRequests }) : t("allClear")}
              </span>
            </div>
            {kpis.pendingChangeRequests === 0 ? (
              <p className="mt-3 rounded-sm border border-divider bg-canvas/60 px-3 py-3 text-[12px] font-medium text-muted">
                {t("noChangeRequests")}
              </p>
            ) : (
              <Link href="/notifications" className="mt-3 block rounded-sm border border-warning/40 bg-warning-tint p-4 text-[12px] font-semibold text-tint-fg-amber transition-colors hover:border-warning/70">
                {t("reviewRequests", { count: kpis.pendingChangeRequests })}
              </Link>
            )}
          </section>

          {/* Upcoming formations */}
          <section aria-label={t("nextUpLabel")} className="card p-5">
            <h3 className="text-[14px] font-bold text-obsidian">{t("upNextTitle")}</h3>
            <ul className="mt-3 space-y-3">
              {futureEvents.slice(0, 3).map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-sm bg-tint-green text-[13px] font-extrabold leading-none text-tint-fg-green">
                    {f.day === "Today" ? t("today").slice(0, 3).toUpperCase() : f.day.slice(0, 3).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-obsidian" title={f.title}>{f.title}</p>
                    <p className="text-[11px] font-medium text-obsidian-light">{f.day} · {f.time.split(" – ")[0]}</p>
                  </div>
                </li>
              ))}
              {futureEvents.length === 0 && (
                <li className="rounded-sm border border-dashed border-border px-3 py-4 text-center text-[12px] font-medium text-muted">
                  {t("nothingScheduled")}
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Future events */}
        <section aria-label={t("futureEventsLabel")} className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-[-0.02em] text-obsidian">{t("futureEventsTitle")}</h3>
            <Link href="/calendar" className="text-[12px] font-bold text-electric hover:text-electric-hover">{t("viewAll")}</Link>
          </div>
          <ul className="mt-4 space-y-3">
            {futureEvents.map((e, i) => (
              <li key={i} className="rounded-md border border-border bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center border-r border-divider pr-4">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{e.day}</span>
                    <span className="mt-1 text-[12px] font-extrabold tabular-nums text-obsidian">{e.time.split(" – ")[0]}</span>
                    <span className="text-[11px] font-medium text-muted tabular-nums">{e.time.split(" – ")[1]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug text-obsidian">{e.title}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-obsidian-light">{e.meta}</p>
                    <span className="chip mt-1.5 bg-electric-tint text-[11px] font-bold text-electric">{e.chip}</span>
                  </div>
                </div>
              </li>
            ))}
            {futureEvents.length === 0 && (
              <li className="rounded-md border border-dashed border-border px-4 py-8 text-center text-[12px] font-medium text-muted">
                {t("noUpcomingEvents")}
              </li>
            )}
          </ul>
        </section>

        {/* Plans in flight */}
        <section aria-label={t("plansInFlightLabel")} className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-[-0.02em] text-obsidian">{t("plansInFlightTitle")}</h3>
            <Link href="/plans" className="text-[12px] font-bold text-electric hover:text-electric-hover">{t("viewAll")}</Link>
          </div>
          <ul className="mt-4 space-y-4">
            {plansInFlight.map((p, i) => (
              <li key={i}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-bold leading-snug text-obsidian">{p.title}</p>
                  <span className="font-mono text-[12px] font-bold text-obsidian-light tabular-nums">{p.pct}%</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-track" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={p.title}>
                    <div className="h-full rounded-pill bg-electric transition-all duration-slower" style={{ width: `${p.pct}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-semibold text-muted tabular-nums">{p.tasks}</span>
                </div>
              </li>
            ))}
            {plansInFlight.length === 0 && (
              <li className="rounded-md border border-dashed border-border px-4 py-8 text-center">
                <p className="text-[12px] font-medium text-muted">{t("noActivePlans")}</p>
                <Link href="/plans" className="btn btn-secondary mt-3 h-9 text-[12px]">{t("createFirstPlan")}</Link>
              </li>
            )}
          </ul>
        </section>

        {/* Room utilization */}
        <section aria-label={t("roomUtilizationLabel")} className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-[-0.02em] text-obsidian">{t("roomUtilizationTitle")}</h3>
            <BarChart3 size={16} className="text-muted" aria-hidden="true" />
          </div>
          <ul className="mt-4 space-y-4">
            {utilization.map((u, i) => (
              <li key={i}>
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-obsidian">
                    <DoorOpen size={14} strokeWidth={2} className="text-muted" aria-hidden="true" />
                    {u.room}
                  </p>
                  <span className="font-mono text-[12px] font-bold text-obsidian-light tabular-nums">{u.pct}%</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-pill bg-track">
                  <div className="h-full rounded-pill bg-electric transition-all duration-slower" style={{ width: `${u.pct}%` }} />
                </div>
              </li>
            ))}
            {utilization.length === 0 && (
              <li className="rounded-md border border-dashed border-border px-4 py-8 text-center text-[12px] font-medium text-muted">
                {t("addRoomsUtilization")}
              </li>
            )}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 border-t border-divider pt-3 text-[11px] font-medium text-muted">
            <CalendarDays size={12} strokeWidth={2} aria-hidden="true" />
            {t("utilizationFootnote")}
          </p>
        </section>
      </div>

      {/* Wordmark footer */}
      <div className="mt-8 hidden items-center justify-center gap-3 opacity-60 lg:flex" aria-hidden="true">
        <Wordmark className="text-[15px]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Architecture for Time.</span>
      </div>
    </div>
  );
}
