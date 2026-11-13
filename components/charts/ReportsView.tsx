"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarDays,
  DoorOpen,
  Download,
  GraduationCap,
  Info,
  PieChart as PieChartIcon,
  Wallet,
} from "lucide-react";
import { Toast } from "@/components/bookings/Toast";
import { useDemoToast } from "./useDemoToast";
import { StatTile } from "./StatTile";
import { ChartCard } from "./ChartCard";
import { Switch } from "./Switch";
import { downloadCsv } from "./csv";
import { formatDayLong, formatMoney, shareOf } from "./format";
import { seededSeries, walkSeries } from "./seed";
import { DEMO_ROOMS, getDemoBookings } from "@/lib/demo-data";

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

type RangeKey = "7D" | "30D" | "90D" | "Q";
type LocationKey = "all" | "casa" | "agadir";

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "7D", label: "7D" },
  { key: "30D", label: "30D" },
  { key: "90D", label: "90D" },
  { key: "Q", label: "Quarter" },
];
const RANGE_DAYS: Record<RangeKey, number> = { "7D": 7, "30D": 30, "90D": 90, "Q": 91 };
const RANGE_CAPTION: Record<RangeKey, string> = {
  "7D": "Last 7 days",
  "30D": "Last 30 days",
  "90D": "Last 90 days",
  Q: "Quarter to date",
};

const LOCATION_OPTIONS: Array<{ key: LocationKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "casa", label: "Casablanca" },
  { key: "agadir", label: "Agadir" },
];
const LOC_LABEL: Record<LocationKey, string> = {
  all: "All locations",
  casa: "Casablanca",
  agadir: "Agadir",
};
const LOC_SCALE: Record<LocationKey, number> = { all: 1, casa: 0.68, agadir: 0.32 };

/** Headline KPIs — deterministic constants; 30D/All is the brand reference (MAD 48,650 · 68% · 81%). */
const HEADLINE: Record<RangeKey, { bookings: number; revenue: number; util: number; fill: number }> = {
  "7D": { bookings: 63, revenue: 11_240, util: 71, fill: 84 },
  "30D": { bookings: 214, revenue: 48_650, util: 68, fill: 81 },
  "90D": { bookings: 598, revenue: 141_300, util: 64, fill: 78 },
  Q: { bookings: 572, revenue: 129_900, util: 66, fill: 80 },
};

const utilFor = (range: RangeKey, loc: LocationKey) =>
  HEADLINE[range].util + (loc === "casa" ? 3 : loc === "agadir" ? -8 : 0);
const fillFor = (range: RangeKey, loc: LocationKey) =>
  HEADLINE[range].fill + (loc === "casa" ? 4 : loc === "agadir" ? -11 : 0);

const ROOM_LOCATION: Record<string, LocationKey> = Object.fromEntries(
  DEMO_ROOMS.map((r) => [r.id, r.location === "Agadir" ? "agadir" : "casa"]),
);

/* ------------------------------------------------------------------ */
/* Bookings-per-day buckets — seeded baseline + demo overlay           */
/* ------------------------------------------------------------------ */

interface DayBucket {
  label: string;
  fullLabel: string;
  count: number;
  revenue: number;
  prevCount: number;
}

function buildBuckets(range: RangeKey, loc: LocationKey): DayBucket[] {
  const days = RANGE_DAYS[range];
  const bucketCount = days > 45 ? Math.ceil(days / 7) : days;
  const base = loc === "agadir" ? 2.4 : loc === "casa" ? 4.8 : 7.1;
  const spread = loc === "agadir" ? 2.2 : loc === "casa" ? 3.6 : 4.8;
  const counts = seededSeries(`bk:${range}:${loc}`, bucketCount, base, spread);
  const revenues = seededSeries(`rev:${range}:${loc}`, bucketCount, Math.round(base * 195), Math.round(spread * 260));
  const prevCounts = seededSeries(`bk:prev:${range}:${loc}`, bucketCount, base * 0.86, spread);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - (days - 1));

  const buckets: DayBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const sOffset = Math.floor((i * days) / bucketCount);
    const eOffset = Math.floor(((i + 1) * days) / bucketCount) - 1;
    const bucketStart = new Date(startDay);
    bucketStart.setDate(startDay.getDate() + sOffset);
    const bucketEnd = new Date(startDay);
    bucketEnd.setDate(startDay.getDate() + eOffset);
    const isWeek = bucketCount < days;
    return {
      label: bucketStart.toLocaleDateString("en-GB", isWeek ? { day: "numeric", month: "short" } : { weekday: "short", day: "numeric" }),
      fullLabel: isWeek
        ? `${formatDayLong(bucketStart)} – ${formatDayLong(bucketEnd)}`
        : formatDayLong(bucketStart),
      count: counts[i] ?? 0,
      revenue: revenues[i] ?? 0,
      prevCount: prevCounts[i] ?? 0,
    };
  });

  // Overlay the real demo bookings (bucketed by local day relative to today).
  // TODO(WIRE): replace with bookings table aggregate (count + sum(price)) per day.
  for (const b of getDemoBookings()) {
    if (b.status === "cancelled") continue;
    const roomLoc = b.room_id ? ROOM_LOCATION[b.room_id] : null;
    if (loc !== "all" && roomLoc !== loc) continue;
    const day = new Date(b.starts_at);
    day.setHours(0, 0, 0, 0);
    const offset = Math.round((day.getTime() - startDay.getTime()) / 86400000);
    if (offset < 0 || offset >= days) continue;
    const idx = Math.min(bucketCount - 1, Math.floor((offset * bucketCount) / days));
    buckets[idx].count += 1;
    buckets[idx].revenue += b.price ?? 0;
  }

  return buckets;
}

/* ------------------------------------------------------------------ */
/* Static demo datasets (range/location-scaled deterministically)      */
/* ------------------------------------------------------------------ */

const CATEGORY_BASE = [
  { name: "Room rental", value: 26_240, color: "var(--color-electric)" },
  { name: "Formation", value: 15_570, color: "var(--color-success)" },
  { name: "Event", value: 6_840, color: "var(--color-tint-fg-purple)" },
];

const ROOM_UTIL_BASE = [
  { room: "Salle Formation", pct: 84, hours: 71, location: "casa" as LocationKey },
  { room: "Salle Grande", pct: 66, hours: 54, location: "casa" as LocationKey },
  { room: "Salle Petite", pct: 52, hours: 39, location: "agadir" as LocationKey },
];
const UTIL_RANGE_TWEAK: Record<RangeKey, number> = { "7D": 3, "30D": 0, "90D": -4, Q: -2 };

interface FormationPerformanceRow {
  name: string;
  sessions: number;
  enrolled: number;
  capacity: number;
  fill: number;
  attendance: number;
  noShows: number;
  full?: boolean;
}
const FORMATION_ROWS: FormationPerformanceRow[] = [
  { name: "Excel Avancé", sessions: 6, enrolled: 120, capacity: 120, fill: 100, attendance: 96, noShows: 5, full: true },
  { name: "React Avancé", sessions: 4, enrolled: 68, capacity: 80, fill: 85, attendance: 88, noShows: 6 },
  { name: "Formation Agile", sessions: 5, enrolled: 74, capacity: 100, fill: 74, attendance: 82, noShows: 9 },
  { name: "Onboarding RH", sessions: 3, enrolled: 45, capacity: 60, fill: 75, attendance: 79, noShows: 7 },
];

/* ------------------------------------------------------------------ */
/* Custom tooltips — dark obsidian pill, no chart junk                 */
/* ------------------------------------------------------------------ */

function BookingsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DayBucket }>;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-sm border border-white/10 bg-obsidian px-3 py-2 text-white shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">{p.fullLabel}</p>
      <p className="mt-1 font-mono text-[12px] font-semibold tabular-nums">
        {p.count} booking{p.count === 1 ? "" : "s"} · MAD {formatMoney(p.revenue)}
      </p>
      <p className="font-mono text-[10.5px] font-medium text-white/55 tabular-nums">
        Previous: {p.prevCount}
      </p>
    </div>
  );
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number; payload?: { share: number } }>;
}) {
  const item = payload?.[0];
  if (!active || !item) return null;
  return (
    <div className="rounded-sm border border-white/10 bg-obsidian px-3 py-2 text-white shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">{item.name}</p>
      <p className="mt-1 font-mono text-[12px] font-semibold tabular-nums">
        MAD {formatMoney(item.value ?? 0)} · {item.payload?.share ?? 0}%
      </p>
    </div>
  );
}

function UtilTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: { room: string; pct: number; hours: number } }>;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-sm border border-white/10 bg-obsidian px-3 py-2 text-white shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">{p.room}</p>
      <p className="mt-1 font-mono text-[12px] font-semibold tabular-nums">
        {p.pct}% booked · {p.hours}h
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function ReportsView() {
  const { toast, showToast, dismiss } = useDemoToast();
  const [range, setRange] = useState<RangeKey>("30D");
  const [location, setLocation] = useState<LocationKey>("all");
  const [compare, setCompare] = useState(true);

  /* ----- derived dataset (deterministic) ----- */
  const buckets = useMemo(() => buildBuckets(range, location), [range, location]);
  const totalBookingsInChart = useMemo(() => buckets.reduce((s, b) => s + b.count, 0), [buckets]);
  const peak = useMemo(
    () => buckets.reduce((best, b) => (b.count > best.count ? b : best), buckets[0]),
    [buckets],
  );

  const revenueScale = (HEADLINE[range].revenue / 48_650) * LOC_SCALE[location];
  const categoryData = CATEGORY_BASE.map((c) => ({
    ...c,
    value: Math.round(c.value * revenueScale),
  }));
  const categoryTotal = categoryData.reduce((s, c) => s + c.value, 0);
  const categoryDataWithShare = categoryData.map((c) => ({
    ...c,
    share: shareOf(c.value, categoryTotal),
  }));

  const utilData = useMemo(
    () =>
      ROOM_UTIL_BASE.filter((r) => location === "all" || r.location === location).map((r) => ({
        ...r,
        pct: Math.min(96, Math.max(4, r.pct + UTIL_RANGE_TWEAK[range])),
      })),
    [location, range],
  );

  const formationRows = useMemo(() => (location === "agadir" ? [] : FORMATION_ROWS), [location]);

  /* ----- KPIs ----- */
  const headline = HEADLINE[range];
  const bookingsKpi = Math.round(headline.bookings * LOC_SCALE[location]);
  const revenueKpi = Math.round((headline.revenue * LOC_SCALE[location]) / 10) * 10;
  const utilKpi = utilFor(range, location);
  const fillKpi = fillFor(range, location);

  const tiles = [
    {
      label: "Bookings",
      value: formatMoney(bookingsKpi),
      delta: "+12%",
      trend: "up" as const,
      iconTint: "bg-tint-blue text-electric",
      series: walkSeries(`spark:bk:${range}:${location}`, 12, 9, 4),
      sparkLabel: "Bookings trend — gently rising over the period",
      icon: CalendarDays,
    },
    {
      label: "Revenue",
      value: formatMoney(revenueKpi),
      prefix: "MAD",
      delta: "+8%",
      trend: "up" as const,
      iconTint: "bg-tint-green text-tint-fg-green",
      series: walkSeries(`spark:rev:${range}:${location}`, 12, 120, 34),
      sparkLabel: "Revenue trend — gently rising over the period",
      icon: Wallet,
    },
    {
      label: "Room utilization",
      value: String(utilKpi),
      suffix: "%",
      delta: "+5 pts",
      trend: "up" as const,
      iconTint: "bg-tint-purple text-tint-fg-purple",
      series: walkSeries(`spark:util:${range}:${location}`, 12, 52, 5),
      sparkLabel: "Room utilization trend — gently rising over the period",
      icon: DoorOpen,
    },
    {
      label: "Formation fill-rate",
      value: String(fillKpi),
      suffix: "%",
      delta: "+9 pts",
      trend: "up" as const,
      iconTint: "bg-tint-amber text-tint-fg-amber",
      series: walkSeries(`spark:fill:${range}:${location}`, 12, 62, 6),
      sparkLabel: "Fill-rate trend — gently rising over the period",
      icon: GraduationCap,
    },
  ];

  /* ----- CSV exports (TODO(WIRE): route-handler streaming when backend lands) ----- */
  const exportBookings = useCallback(() => {
    // TODO(WIRE): replace with GET /api/reports/bookings.csv (streamed, auth-checked).
    downloadCsv("calendar-bookings-per-day.csv", [
      ["CALENDAR. — Bookings per day", RANGE_CAPTION[range], LOC_LABEL[location]],
      ["Date", "Bookings", "Revenue (MAD)"],
      ...buckets.map((b) => [b.fullLabel, b.count, b.revenue]),
      ["Total", totalBookingsInChart, buckets.reduce((s, b) => s + b.revenue, 0)],
    ]);
  }, [buckets, range, location, totalBookingsInChart]);

  const exportRevenue = useCallback(() => {
    // TODO(WIRE): replace with GET /api/reports/revenue-by-category.csv.
    downloadCsv("calendar-revenue-by-category.csv", [
      ["CALENDAR. — Revenue by category", RANGE_CAPTION[range], LOC_LABEL[location]],
      ["Category", "Revenue (MAD)", "Share (%)"],
      ...categoryDataWithShare.map((c) => [c.name, c.value, c.share]),
      ["Total", categoryTotal, 100],
    ]);
  }, [categoryDataWithShare, categoryTotal, range, location]);

  const exportUtilization = useCallback(() => {
    // TODO(WIRE): replace with GET /api/reports/utilization-by-room.csv.
    downloadCsv("calendar-utilization-by-room.csv", [
      ["CALENDAR. — Utilization by room", RANGE_CAPTION[range], LOC_LABEL[location]],
      ["Room", "Utilization (%)", "Booked hours"],
      ...utilData.map((r) => [r.room, r.pct, r.hours]),
    ]);
  }, [utilData, range, location]);

  const exportFormations = useCallback(() => {
    // TODO(WIRE): replace with GET /api/reports/formation-performance.csv.
    downloadCsv("calendar-formation-performance.csv", [
      ["CALENDAR. — Formation performance", RANGE_CAPTION[range], LOC_LABEL[location]],
      ["Formation", "Sessions", "Enrolled", "Capacity", "Fill (%)", "Attendance (%)", "No-shows"],
      ...formationRows.map((r) => [r.name, r.sessions, r.enrolled, r.capacity, r.fill, r.attendance, r.noShows]),
    ]);
  }, [formationRows, range, location]);

  const exportAll = useCallback(() => {
    exportBookings();
    exportRevenue();
    exportUtilization();
    exportFormations();
    showToast("4 CSVs downloaded (demo)", "Bookings · revenue · utilization · formations");
  }, [exportBookings, exportRevenue, exportUtilization, exportFormations, showToast]);

  const segmentedButton = (active: boolean) =>
    `segment ${active ? "segment-active" : ""}`;

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.04em] text-obsidian sm:text-[32px]">
            Reports
          </h1>
          <p className="mt-1 max-w-xl text-[14px] font-medium text-obsidian-light">
            Rooms, revenue and formations — numbers your accountant will love
          </p>
        </div>
        <button type="button" onClick={exportAll} className="btn btn-secondary h-11 border border-border bg-white text-[13px]">
          <Download size={16} strokeWidth={2.2} aria-hidden="true" />
          Export all
        </button>
      </div>

      {/* Controls row */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="segmented" role="group" aria-label="Date range">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={segmentedButton(range === opt.key)}
              aria-pressed={range === opt.key}
              onClick={() => setRange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="hidden h-5 w-px bg-divider md:block" aria-hidden="true" />
        <div className="segmented" role="group" aria-label="Location">
          {LOCATION_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={segmentedButton(location === opt.key)}
              aria-pressed={location === opt.key}
              onClick={() => setLocation(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Switch
            id="compare-toggle"
            checked={compare}
            onChange={setCompare}
            label="vs previous period"
            caption="Switches delta arrows and the dashed line"
          />
        </div>
      </div>

      {/* KPI strip */}
      <section aria-label="Key metrics" className="mt-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            prefix={tile.prefix}
            suffix={tile.suffix}
            delta={tile.delta}
            trend={tile.trend}
            series={tile.series}
            comparison={compare}
            icon={tile.icon}
            tint={tile.iconTint}
            sparkLabel={tile.sparkLabel}
          />
        ))}
      </section>

      {/* Charts grid */}
      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-2">
        {/* (1) Bookings per day */}
        <ChartCard
          title="Bookings per day"
          icon={BarChart3}
          onExport={exportBookings}
          caption={`${RANGE_CAPTION[range]} · ${LOC_LABEL[location]}. Demo bookings bucketed by day on a seeded baseline — wire to a bookings daily-aggregate view.`}
        >
          <div
            role="img"
            aria-label={`Bookings per day, ${RANGE_CAPTION[range].toLowerCase()}, ${LOC_LABEL[location].toLowerCase()}. Total ${totalBookingsInChart} bookings. Peak of ${peak.count} on ${peak.fullLabel}.`}
            className="h-[212px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={buckets} margin={{ top: 8, right: 2, left: 2, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  dy={4}
                  minTickGap={18}
                  tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                />
                <YAxis hide domain={[0, "dataMax + 3"]} allowDecimals={false} />
                <Tooltip content={<BookingsTooltip />} cursor={{ fill: "var(--color-hover-fill)", fillOpacity: 0.6 }} />
                <Bar dataKey="count" name="Bookings" fill="var(--color-electric)" radius={[5, 5, 0, 0]} maxBarSize={26} />
                {compare && (
                  <Line
                    type="monotone"
                    dataKey="prevCount"
                    name="Previous period"
                    stroke="var(--color-muted)"
                    strokeWidth={1.6}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {compare && (
            <div className="mt-2 flex items-center justify-center gap-5 text-[10.5px] font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-pill bg-electric" />
                This period
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-0 w-5 border-t-2 border-dashed border-muted" />
                Previous period
              </span>
            </div>
          )}
        </ChartCard>

        {/* (2) Revenue by category — donut */}
        <ChartCard
          title="Revenue by category"
          icon={PieChartIcon}
          iconTint="bg-tint-green text-tint-fg-green"
          onExport={exportRevenue}
          caption="Share of indicative booking revenue. Room rental + Formation + Event."
        >
          <div
            role="img"
            aria-label={`Revenue by category donut chart, total MAD ${formatMoney(categoryTotal)}. Room rental ${categoryDataWithShare[0].share} percent, Formation ${categoryDataWithShare[1].share} percent, Event ${categoryDataWithShare[2].share} percent.`}
            className="relative h-[196px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDataWithShare}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={76}
                  paddingAngle={3}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                >
                  {categoryDataWithShare.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Total</span>
              <span className="mt-0.5 font-mono text-[15px] font-bold leading-none text-obsidian tabular-nums">
                {formatMoney(categoryTotal)}
              </span>
              <span className="mt-0.5 text-[9px] font-semibold text-muted">MAD</span>
            </div>
          </div>
          <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            {categoryDataWithShare.map((c) => (
              <li
                key={c.name}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-obsidian-light"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-pill"
                  style={{ background: c.color }}
                />
                {c.name}
                <span className="font-mono tabular-nums">{c.share}%</span>
              </li>
            ))}
          </ul>
        </ChartCard>

        {/* (3) Utilization by room — horizontal bars */}
        <ChartCard
          title="Utilization by room"
          icon={DoorOpen}
          iconTint="bg-tint-purple text-tint-fg-purple"
          onExport={exportUtilization}
          caption="Hours booked ÷ bookable hours (08:00–19:00, Mon–Sat)."
        >
          <div
            role="img"
            aria-label={`Utilization by room. ${utilData.map((r) => `${r.room} ${r.pct} percent`).join(", ")}.`}
            className="h-[212px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={utilData} margin={{ top: 4, right: 36, bottom: 4, left: 0 }} barCategoryGap="26%">
                <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="4 4" />
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis
                  type="category"
                  dataKey="room"
                  width={118}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11.5, fontWeight: 600, fill: "var(--color-obsidian-light)" }}
                />
                <Tooltip content={<UtilTooltip />} cursor={{ fill: "var(--color-hover-fill)", fillOpacity: 0.5 }} />
                <Bar
                  dataKey="pct"
                  name="Utilization"
                  fill="var(--color-electric)"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={17}
                  background={{ fill: "var(--color-track)" }}
                >
                  <LabelList
                    dataKey="pct"
                    position="right"
                    formatter={(v) => `${v}%`}
                    fill="var(--color-obsidian-light)"
                    fontSize={11}
                    fontWeight={700}
                    className="font-mono tabular-nums"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* (4) Formation performance — table */}
        <ChartCard
          title="Formation performance"
          icon={GraduationCap}
          iconTint="bg-tint-green text-tint-fg-green"
          onExport={exportFormations}
          exportDisabled={formationRows.length === 0}
          caption="Attendance = attended / enrolled (day-of check-in)"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left">
              <thead>
                <tr className="border-b border-divider">
                  <th scope="col" className="py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.09em] text-muted">
                    Formation
                  </th>
                  {["Sess.", "Enrolled", "Fill", "Attend.", "No-shows"].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-[0.09em] text-muted last:pr-0"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {formationRows.map((row) => (
                  <tr key={row.name} className="transition-colors hover:bg-canvas/70">
                    <th scope="row" className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="whitespace-nowrap text-[12.5px] font-bold text-obsidian">
                          {row.name}
                        </span>
                        {row.full && (
                          <span className="chip bg-error-tint text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-error">
                            Full
                          </span>
                        )}
                      </span>
                    </th>
                    <td className="px-2 py-2.5 text-right font-mono text-[12px] font-semibold text-obsidian-light tabular-nums">
                      {row.sessions}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[12px] font-semibold text-obsidian-light tabular-nums">
                      {row.enrolled}
                      <span className="text-[10px] text-muted">/{row.capacity}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center justify-end gap-1.5">
                        <span
                          className="h-1.5 w-12 overflow-hidden rounded-pill bg-track"
                          role="progressbar"
                          aria-valuenow={row.fill}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Fill rate for ${row.name}`}
                        >
                          <span
                            className={`block h-full rounded-pill ${row.fill >= 100 ? "bg-success" : "bg-electric"}`}
                            style={{ width: `${row.fill}%` }}
                          />
                        </span>
                        <span className="font-mono text-[12px] font-bold text-obsidian tabular-nums">
                          {row.fill}%
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[12px] font-semibold text-obsidian-light tabular-nums">
                      {row.attendance}%
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono text-[12px] font-semibold text-obsidian-light tabular-nums">
                      {row.noShows}
                    </td>
                  </tr>
                ))}
                {formationRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[12.5px] font-medium text-muted">
                      No formations in Agadir during this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Footnote */}
      <p className="mt-4 flex max-w-2xl items-start gap-1.5 text-[11px] font-medium leading-snug text-muted">
        <Info size={12} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden="true" />
        Revenue is indicative (sum of booking prices); CALENDAR. is not an invoicing tool.
      </p>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
