import Link from "next/link";
import { connection } from "next/server";
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

export const metadata = { title: "Dashboard" };
// Entire page is time-dependent (now-line, today highlight) — block prerender.
export const instant = false;

/* ---------------- mock data (preview) ---------------- */
const KPIS = [
  { label: "Today's bookings", value: "9", delta: "+2 vs yesterday", up: true, tint: "bg-tint-blue text-electric", spark: "0,28 12,24 24,26 36,18 48,20 60,12 72,16 84,8" },
  { label: "Room utilization (week)", value: "68%", delta: "+6 pts vs last week", up: true, tint: "bg-tint-green text-tint-fg-green", spark: "0,24 12,22 24,20 36,21 48,16 60,14 72,12 84,10" },
  { label: "Formation fill-rate (month)", value: "81%", delta: "+9 pts", up: true, tint: "bg-tint-purple text-tint-fg-purple", spark: "0,26 12,25 24,23 36,22 48,19 60,15 72,13 84,11" },
  { label: "Pending change requests", value: "2", delta: "Waiting on you/others", up: false, tint: "bg-warning-tint text-[#a34d00]", spark: "0,20 12,20 24,16 36,18 48,15 60,17 72,14 84,15" },
];

const ROOMS = ["Salle Grande · 12p", "Salle Petite · 6p", "Salle Formation · 20p"];

type MockBooking = { day: number; room: number; time: string; title: string; tint: "blue" | "green" | "purple" | "amber" };
const BOOKINGS: MockBooking[] = [
  { day: 0, room: 0, time: "09:30", title: "Acme SARL — Board", tint: "blue" },
  { day: 0, room: 2, time: "14:00", title: "React Avancé S3", tint: "green" },
  { day: 1, room: 1, time: "10:00", title: "Interview — Stagiaire", tint: "purple" },
  { day: 1, room: 0, time: "15:30", title: "ONCF — Réservation", tint: "blue" },
  { day: 2, room: 2, time: "09:00", title: "Formation Agile S1", tint: "green" },
  { day: 2, room: 0, time: "13:00", title: "Marjane — Comité", tint: "blue" },
  { day: 3, room: 1, time: "11:30", title: "Client call — Attijariwafa", tint: "purple" },
  { day: 3, room: 2, time: "16:00", title: "React Avancé S4 · waitlist", tint: "amber" },
  { day: 4, room: 0, time: "09:00", title: "Install — équipe", tint: "purple" },
  { day: 5, room: 1, time: "10:30", title: "Coworking — libre", tint: "blue" },
];
const PILL: Record<MockBooking["tint"], string> = {
  blue: "bg-tint-blue text-tint-fg-blue",
  green: "bg-tint-green text-tint-fg-green",
  purple: "bg-tint-purple text-tint-fg-purple",
  amber: "bg-warning-tint text-[#a34d00] border border-dashed border-warning/50",
};

const FUTURE_EVENTS = [
  { day: "Today", time: "14:00 – 16:00", title: "React Avancé — Session 3", meta: "Salle Formation · 14/20 seats", chip: "In 2h" },
  { day: "Today", time: "17:30 – 18:15", title: "Revue produit — Équipe", meta: "Salle Petite · Agadir", chip: "In 5h" },
  { day: "Tomorrow", time: "09:30 – 12:30", title: "Formation Agile — Module 1", meta: "Salle Formation · 18/20 seats", chip: "Tomorrow" },
];

const PLANS = [
  { title: "Open Salle Formation — March", tasks: "4/6 tasks", pct: 67 },
  { title: "Agadir second location", tasks: "2/5 tasks", pct: 40 },
  { title: "Website + booking funnel", tasks: "5/8 tasks", pct: 62 },
];

const UTILIZATION = [
  { room: "Salle Formation", pct: 84 },
  { room: "Salle Grande", pct: 66 },
  { room: "Salle Petite", pct: 52 },
];

/* ---------------- helpers ---------------- */
function currentWeek() {
  const today = new Date();
  const offset = (today.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(today);
  monday.setDate(today.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

const hatch = {
  backgroundImage:
    "repeating-linear-gradient(-45deg, rgba(0,0,0,0.035) 0 6px, transparent 6px 12px)",
};

/* ---------------- page ---------------- */
export default async function DashboardPage() {
  // Request-time render: the "now" line, today highlight and date header shift hourly.
  await connection();
  const days = currentWeek();
  const todayIdx = days.findIndex(
    (d) => d.toDateString() === new Date().toDateString(),
  );
  const todayLong = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.04em] text-obsidian sm:text-[32px]">
            Good morning, Marouane
          </h1>
          <p className="mt-1 text-[14px] font-medium text-obsidian-light">{todayLong} · Eiden Group</p>
        </div>
        <Link href="/calendar" className="btn btn-primary h-11 shadow-electric">
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
          New booking
        </Link>
      </div>

      {/* KPI row */}
      <section aria-label="Key metrics" className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-sm ${kpi.tint}`}>
                <TrendingUp size={17} strokeWidth={2} aria-hidden="true" />
              </span>
              <svg width="84" height="28" viewBox="0 0 84 28" aria-hidden="true" className="overflow-visible">
                <polyline
                  points={kpi.spark}
                  fill="none"
                  stroke="#0066CC"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />
              </svg>
            </div>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{kpi.label}</p>
            <p className="mt-0.5 text-[26px] font-extrabold leading-none tracking-[-0.03em] text-obsidian">{kpi.value}</p>
            <p className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${kpi.up ? "text-success" : "text-warning"}`}>
              {kpi.up ? <ArrowUpRight size={12} strokeWidth={2.6} /> : <BellRing size={12} strokeWidth={2.2} />}
              {kpi.delta}
            </p>
          </div>
        ))}
      </section>

      {/* Hero: schedule grid + right rail */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        {/* ----- Schedule grid card ----- */}
        <section aria-label="This week" className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider p-4 sm:p-5">
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-obsidian">This week — rooms</h2>
            <div className="flex items-center gap-2">
              <span className="chip bg-tint-green text-tint-fg-green">Formation</span>
              <span className="chip bg-tint-blue text-tint-fg-blue">Room rental</span>
              <span className="chip bg-tint-purple text-tint-fg-purple">Internal</span>
              <span className="chip border border-dashed border-warning/60 bg-warning-tint text-[#a34d00]">Pending</span>
            </div>
          </div>

          {/* Day strip */}
          <div className="grid grid-cols-7 gap-1.5 border-b border-divider p-3 sm:gap-2 sm:p-4">
            {days.map((d, i) => {
              const today = i === todayIdx;
              const weekend = d.getDay() === 0 || d.getDay() === 6;
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
                  <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${today ? "text-white/85" : "text-muted"}`}>
                    {dayLabel(d)}
                  </span>
                  <span className="mt-0.5 text-[17px] font-extrabold leading-none">{d.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Rooms × days grid (scrolls horizontally on small screens) */}
          <div className="overflow-x-auto">
            <div className="min-w-[760px] p-3 sm:p-4">
              {ROOMS.map((room, roomIdx) => (
                <div key={room} className="grid grid-cols-[150px_repeat(7,1fr)] gap-1.5 border-b border-divider py-2 last:border-0">
                  <div className="flex flex-col justify-center pr-2">
                    <span className="text-[12px] font-bold leading-tight text-obsidian">{room.split(" · ")[0]}</span>
                    <span className="text-[10px] font-medium text-muted">{room.split(" · ")[1]} pax</span>
                  </div>
                  {days.map((d, dayIdx) => {
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    const cellBookings = BOOKINGS.filter((b) => b.day === dayIdx && b.room === roomIdx);
                    const isTodayCol = dayIdx === todayIdx;
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
                          {cellBookings.map((b, i) => (
                            <div
                              key={i}
                              title={`${b.time} — ${b.title}`}
                              className={`truncate rounded-[6px] px-1.5 py-1 text-[9px] font-semibold leading-tight ${PILL[b.tint]}`}
                            >
                              <span className="font-bold">{b.time}</span> {b.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-divider px-4 py-3">
            <p className="text-[11px] font-medium text-muted">Preview with demo data — connects to Supabase in Phase 2.</p>
            <Link href="/calendar" className="inline-flex items-center gap-1 text-[12px] font-bold text-electric hover:text-electric-hover">
              Open calendar <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* ----- Right rail ----- */}
        <div className="flex flex-col gap-4">
          {/* Welcome card */}
          <section aria-label="Welcome" className="card relative overflow-hidden p-5">
            <div className="absolute -right-6 -top-6 opacity-[0.07]" aria-hidden="true">
              <NowBarMark size={150} />
            </div>
            <div className="relative">
              <NowBarMark size={36} />
              <h2 className="mt-3 text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-obsidian">
                Welcome back,
                <br />
                Marouane
              </h2>
              <p className="mt-1.5 text-[13px] font-medium text-obsidian-light">
                9 bookings today · 1 formation almost full · 2 change requests waiting.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/calendar" className="btn btn-primary h-10 w-full gap-1.5 text-[12px]">
                  <Plus size={15} strokeWidth={2.6} aria-hidden="true" /> Booking
                </Link>
                <Link href="/formations" className="btn btn-secondary h-10 w-full gap-1.5 border border-border bg-white text-[12px]">
                  <GraduationCap size={15} strokeWidth={2} aria-hidden="true" /> Formation
                </Link>
                <Link href="/clients" className="btn btn-secondary h-10 w-full gap-1.5 border border-border bg-white text-[12px]">
                  <Users size={15} strokeWidth={2} aria-hidden="true" /> Client
                </Link>
                <Link href="/plans" className="btn btn-secondary h-10 w-full gap-1.5 border border-border bg-white text-[12px]">
                  <Zap size={15} strokeWidth={2} aria-hidden="true" /> Plan
                </Link>
              </div>
            </div>
          </section>

          {/* Pending change requests */}
          <section aria-label="Pending change requests" className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-obsidian">Change requests</h3>
              <span className="chip bg-warning-tint font-bold text-[#a34d00]">2 pending</span>
            </div>
            <ul className="mt-3 space-y-2">
              {[
                { room: "Salle Grande", when: "Tomorrow · 14:00", from: "from Yasmine B.", toward: "you asked to move → 16:30" },
                { room: "Salle Formation", when: "Friday · 09:00", from: "from Karim L.", toward: "you asked to move → Sat 10:00" },
              ].map((r, i) => (
                <li key={i}>
                  <Link href="/requests/demo" className="group flex items-start gap-2.5 rounded-sm border border-border bg-canvas/50 p-2.5 transition-colors hover:border-warning/50">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-pill bg-warning" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold leading-snug text-obsidian">
                        {r.room} · {r.when}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium text-obsidian-light">
                        {r.from} · {r.toward}
                      </span>
                    </span>
                    <ChevronRight size={15} strokeWidth={2.4} className="ml-auto mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Upcoming formations */}
          <section aria-label="Upcoming formations" className="card p-5">
            <h3 className="text-[14px] font-bold text-obsidian">Upcoming formations</h3>
            <ul className="mt-3 space-y-3">
              {[
                { title: "React Avancé — S3", date: "Today · 14:00", pct: 70, label: "14/20" },
                { title: "Formation Agile — M1", date: "Tomorrow · 09:30", pct: 90, label: "18/20" },
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0 -rotate-90" aria-hidden="true">
                    <circle cx="23" cy="23" r="18" stroke="#ECECF0" strokeWidth="5" fill="none" />
                    <circle
                      cx="23" cy="23" r="18" stroke="#34C759" strokeWidth="5" fill="none" strokeLinecap="round"
                      strokeDasharray={`${(2 * Math.PI * 18 * f.pct) / 100} ${2 * Math.PI * 18}`}
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-obsidian">{f.title}</p>
                    <p className="text-[11px] font-medium text-obsidian-light">{f.date} · <span className="font-semibold text-tint-fg-green">{f.label} seats</span></p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Future events */}
        <section aria-label="Future events" className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-obsidian">Future events</h3>
            <Link href="/calendar" className="text-[12px] font-bold text-electric hover:text-electric-hover">View all</Link>
          </div>
          <ul className="mt-4 space-y-3">
            {FUTURE_EVENTS.map((e, i) => (
              <li key={i} className="relative rounded-md border border-border bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center border-r border-divider pr-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{e.day}</span>
                    <span className="mt-1 whitespace-nowrap text-[12px] font-extrabold text-obsidian">{e.time.split(" – ")[0]}</span>
                    <span className="text-[10px] font-medium text-muted">{e.time.split(" – ")[1]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug text-obsidian">{e.title}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-obsidian-light">{e.meta}</p>
                    <span className="chip mt-1.5 bg-electric-tint text-[10px] font-bold text-electric">{e.chip}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Plans in flight */}
        <section aria-label="Plans in flight" className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-obsidian">Plans in flight</h3>
            <Link href="/plans" className="text-[12px] font-bold text-electric hover:text-electric-hover">View all</Link>
          </div>
          <ul className="mt-4 space-y-4">
            {PLANS.map((p, i) => (
              <li key={i}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-bold leading-snug text-obsidian">{p.title}</p>
                  <span className="font-mono text-[12px] font-bold text-obsidian-light">{p.pct}%</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-track" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={p.title}>
                    <div className="h-full rounded-pill bg-electric transition-all duration-500" style={{ width: `${p.pct}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-[10px] font-semibold text-muted">{p.tasks}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Room utilization */}
        <section aria-label="Room utilization" className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-obsidian">Room utilization</h3>
            <BarChart3 size={16} className="text-muted" aria-hidden="true" />
          </div>
          <ul className="mt-4 space-y-4">
            {UTILIZATION.map((u, i) => (
              <li key={i}>
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-obsidian">
                    <DoorOpen size={14} strokeWidth={2} className="text-muted" aria-hidden="true" />
                    {u.room}
                  </p>
                  <span className="font-mono text-[12px] font-bold text-obsidian-light">{u.pct}%</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-pill bg-track">
                  <div
                    className="h-full rounded-pill bg-gradient-to-r from-electric to-[#3d8bff] transition-all duration-500"
                    style={{ width: `${u.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 border-t border-divider pt-3 text-[11px] font-medium text-muted">
            <CalendarDays size={12} strokeWidth={2} aria-hidden="true" />
            Hours booked ÷ hours available (working hours × rooms), per location — Casablanca &amp; Agadir.
          </p>
        </section>
      </div>

      {/* Wordmark footer */}
      <div className="mt-8 hidden items-center justify-center gap-3 opacity-60 lg:flex" aria-hidden="true">
        <Wordmark className="text-[15px]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Architecture for Time.</span>
      </div>
    </div>
  );
}
