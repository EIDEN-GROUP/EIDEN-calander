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
import { useTranslations, useLocale } from "next-intl";
import { appLocaleTag } from "@/lib/intl-locale";
import { StatTile } from "./StatTile";
import { ChartCard } from "./ChartCard";
import { Switch } from "./Switch";
import { downloadCsv } from "./csv";
import { formatDayLong, formatMoney, shareOf } from "./format";
import { seededSeries, walkSeries } from "./seed";
import { DEMO_ROOMS, getDemoBookings } from "@/lib/demo-data";
import type { ReportsLive } from "@/lib/reports-live";

/* Controls */

type RangeKey = "7D" | "30D" | "90D" | "Q";
type LocationKey = "all" | "casa" | "agadir";

const RANGE_OPTIONS: Array<{ key: RangeKey; labelKey: "range7d" | "range30d" | "range90d" | "rangeQuarter" }> = [
  { key: "7D", labelKey: "range7d" },
  { key: "30D", labelKey: "range30d" },
  { key: "90D", labelKey: "range90d" },
  { key: "Q", labelKey: "rangeQuarter" },
];
const RANGE_DAYS: Record<RangeKey, number> = { "7D": 7, "30D": 30, "90D": 90, "Q": 91 };
const CAPTION_KEY: Record<RangeKey, "caption7d" | "caption30d" | "caption90d" | "captionQuarter"> = {
  "7D": "caption7d",
  "30D": "caption30d",
  "90D": "caption90d",
  Q: "captionQuarter",
};

const LOCATION_OPTIONS: Array<{ key: LocationKey; labelKey?: "locationAll" }> = [
  { key: "all", labelKey: "locationAll" },
  { key: "casa" },
  { key: "agadir" },
];
const LOC_SCALE: Record<LocationKey, number> = { all: 1, casa: 0.68, agadir: 0.32 };

/** Headline KPIs: deterministic constants; 30D/All is the brand reference (MAD 48,650 · 68% · 81%). */
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

/* Bookings-per-day buckets: seeded baseline + demo overlay */

interface DayBucket {
  label: string;
  fullLabel: string;
  count: number;
  revenue: number;
  prevCount: number;
}

function buildBuckets(range: RangeKey, loc: LocationKey, localeTag: string = appLocaleTag()): DayBucket[] {
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
      label: bucketStart.toLocaleDateString(localeTag, isWeek ? { day: "numeric", month: "short" } : { weekday: "short", day: "numeric" }),
      fullLabel: isWeek
        ? `${formatDayLong(bucketStart, localeTag)} – ${formatDayLong(bucketEnd, localeTag)}`
        : formatDayLong(bucketStart, localeTag),
      count: counts[i] ?? 0,
      revenue: revenues[i] ?? 0,
      prevCount: prevCounts[i] ?? 0,
    };
  });

  // Overlay the real demo bookings (bucketed by local day relative to today).
  // Live mode: the buckets ARE the bookings table aggregated per day (UTC).
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


/* Live aggregates: derived from the server-provided daily series */

function locKey(loc: LocationKey): "all" | "casa" | "agadir" {
  return loc === "casa" ? "casa" : loc === "agadir" ? "agadir" : "all";
}

function liveBuckets(live: ReportsLive, range: RangeKey, loc: LocationKey, localeTag: string = appLocaleTag()): DayBucket[] {
  const days = RANGE_DAYS[range];
  const bucketCount = days > 45 ? Math.ceil(days / 7) : days;
  const key = locKey(loc);
  const cur = live.daily.slice(-days);
  const prev = live.daily.slice(-2 * days, -days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - (days - 1));

  const buckets: DayBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const sOffset = Math.floor((i * days) / bucketCount);
    const eOffset = Math.floor(((i + 1) * days) / bucketCount) - 1;
    let count = 0, revenue = 0, prevCount = 0;
    for (let d = sOffset; d <= eOffset; d++) {
      count += cur[d]?.[key]?.[0] ?? 0;
      revenue += cur[d]?.[key]?.[1] ?? 0;
      prevCount += prev[d]?.[key]?.[0] ?? 0;
    }
    const bucketStart = new Date(startDay);
    bucketStart.setDate(startDay.getDate() + sOffset);
    const bucketEnd = new Date(startDay);
    bucketEnd.setDate(startDay.getDate() + eOffset);
    const isWeek = bucketCount < days;
    return {
      label: bucketStart.toLocaleDateString(localeTag, isWeek ? { day: "numeric", month: "short" } : { weekday: "short", day: "numeric" }),
      fullLabel: isWeek
        ? `${formatDayLong(bucketStart, localeTag)} – ${formatDayLong(bucketEnd, localeTag)}`
        : formatDayLong(bucketStart, localeTag),
      count,
      revenue,
      prevCount,
    };
  });
  return buckets;
}

function liveTotals(live: ReportsLive, range: RangeKey, loc: LocationKey) {
  const days = RANGE_DAYS[range];
  const key = locKey(loc);
  const cur = live.daily.slice(-days);
  const prev = live.daily.slice(-2 * days, -days);
  const sum = (rows: typeof cur, idx: 0 | 1) => rows.reduce((s, r) => s + (r?.[key]?.[idx] ?? 0), 0);
  return {
    bookings: sum(cur, 0),
    revenue: sum(cur, 1),
    prevBookings: sum(prev, 0),
    prevRevenue: sum(prev, 1),
    spark: cur.slice(-12).map((r) => r?.[key]?.[0] ?? 0),
    sparkRevenue: cur.slice(-12).map((r) => r?.[key]?.[1] ?? 0),
  };
}

function fmtDelta(cur: number, prev: number): { text: string; up: boolean } {
  if (prev <= 0) return { text: cur > 0 ? "+100%" : "0%", up: cur >= 0 };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { text: (pct >= 0 ? "+" : "") + pct + "%", up: pct >= 0 };
}

/* Static demo datasets (range/location-scaled deterministically) */

/** Category base values: names are localized at render time via `categoryRoomRental` etc. */
const CATEGORY_BASE = [
  { nameKey: "categoryRoomRental", value: 26_240, color: "var(--color-electric)" },
  { nameKey: "categoryFormation", value: 15_570, color: "var(--color-success)" },
  { nameKey: "categoryEvent", value: 6_840, color: "var(--color-tint-fg-purple)" },
] as const;

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

/* Custom tooltips: dark obsidian pill, no chart junk */

function BookingsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DayBucket }>;
}) {
  const p = payload?.[0]?.payload;
  const t = useTranslations("reports");
  const intlLocale = appLocaleTag(useLocale());
  if (!active || !p) return null;
  return (
    <div className="rounded-sm border border-white/10 bg-obsidian px-3 py-2 text-white shadow-md">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/60">{p.fullLabel}</p>
      <p className="mt-1 font-mono text-[12px] font-semibold tabular-nums">
        {t("tooltipBookingCount", { count: p.count })} · {"MAD\u00A0"}{formatMoney(p.revenue, intlLocale)}
      </p>
      <p className="font-mono text-[11px] font-medium text-white/55 tabular-nums">
        {t("tooltipPrevious", { count: p.prevCount })}
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
  const intlLocale = appLocaleTag(useLocale());
  const item = payload?.[0];
  if (!active || !item) return null;
  return (
    <div className="rounded-sm border border-white/10 bg-obsidian px-3 py-2 text-white shadow-md">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/60">{item.name}</p>
      <p className="mt-1 font-mono text-[12px] font-semibold tabular-nums">
        {"MAD\u00A0"}{formatMoney(item.value ?? 0, intlLocale)} · {item.payload?.share ?? 0}%
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
  const t = useTranslations("reports");
  if (!active || !p) return null;
  return (
    <div className="rounded-sm border border-white/10 bg-obsidian px-3 py-2 text-white shadow-md">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/60">{p.room}</p>
      <p className="mt-1 font-mono text-[12px] font-semibold tabular-nums">
        {t("tooltipBooked", { pct: p.pct, hours: p.hours })}
      </p>
    </div>
  );
}

/* View */

export function ReportsView({ live }: { live?: ReportsLive | null }) {
  const t = useTranslations("reports");
  const intlLocale = appLocaleTag(useLocale());
  const { toast, showToast, dismiss } = useDemoToast();
  const [range, setRange] = useState<RangeKey>("30D");
  const [location, setLocation] = useState<LocationKey>("all");
  const [compare, setCompare] = useState(true);

  /* derived dataset (deterministic) */
  const buckets = useMemo(
    () => (live ? liveBuckets(live, range, location, intlLocale) : buildBuckets(range, location, intlLocale)),
    [live, range, location, intlLocale],
  );
  const totals = useMemo(() => (live ? liveTotals(live, range, location) : null), [live, range, location]);
  const totalBookingsInChart = useMemo(() => buckets.reduce((s, b) => s + b.count, 0), [buckets]);
  const peak = useMemo(
    () => buckets.reduce((best, b) => (b.count > best.count ? b : best), buckets[0]),
    [buckets],
  );

  const revenueScale = (HEADLINE[range].revenue / 48_650) * LOC_SCALE[location];
  const rangeCaption = t(CAPTION_KEY[range]);
  const locLabel = location === "all" ? t("allLocations") : location === "casa" ? "Casablanca" : "Agadir";
  const categoryData = live
    ? live.byCategory.map((c) => ({ name: c.name, value: c.revenue, color: c.color }))
    : CATEGORY_BASE.map((c) => ({
        name: t(c.nameKey),
        color: c.color,
        value: Math.round(c.value * revenueScale),
      }));
  const categoryTotal = categoryData.reduce((s, c) => s + c.value, 0);
  const categoryDataWithShare = categoryData.map((c) => ({
    ...c,
    share: shareOf(c.value, categoryTotal),
  }));

  const utilData = useMemo(
    () =>
      live
        ? live.byRoom
            .filter((r) => location === "all" || r.location === location)
            .map((r) => ({ room: r.room, pct: r.pct, hours: r.hours, location: r.location }))
        : ROOM_UTIL_BASE.filter((r) => location === "all" || r.location === location).map((r) => ({
            ...r,
            pct: Math.min(96, Math.max(4, r.pct + UTIL_RANGE_TWEAK[range])),
          })),
    [live, location, range],
  );

  const formationRows = useMemo(
    () =>
      live
        ? live.formations.filter((f) => location === "all" || f.location === location)
        : location === "agadir"
          ? []
          : FORMATION_ROWS,
    [live, location],
  );

  /* KPIs */
  const headline = HEADLINE[range];
  const bookingsKpi = live && totals ? totals.bookings : Math.round(headline.bookings * LOC_SCALE[location]);
  const revenueKpi = live && totals ? totals.revenue : Math.round((headline.revenue * LOC_SCALE[location]) / 10) * 10;
  const utilKpi = live
    ? utilData.length > 0
      ? Math.round(utilData.reduce((s, r) => s + r.pct, 0) / utilData.length)
      : 0
    : utilFor(range, location);
  const formationAgg = live ? live.formations.filter((f) => location === "all" || f.location === location) : [];
  const fillKpi = live
    ? formationAgg.length > 0
      ? Math.round(formationAgg.reduce((s, f) => s + f.fill, 0) / formationAgg.length)
      : 0
    : fillFor(range, location);
  const bookingsDelta = live && totals ? fmtDelta(totals.bookings, totals.prevBookings) : null;
  const revenueDelta = live && totals ? fmtDelta(totals.revenue, totals.prevRevenue) : null;

  const tiles = [
    {
      label: t("kpiBookings"),
      value: formatMoney(bookingsKpi, intlLocale),
      delta: bookingsDelta?.text ?? "+12%",
      trend: (bookingsDelta?.up ?? true) ? ("up" as const) : ("down" as const),
      iconTint: "bg-tint-blue text-electric",
      series: live && totals ? totals.spark : walkSeries(`spark:bk:${range}:${location}`, 12, 9, 4),
      sparkLabel: t("sparkBookings"),
      icon: CalendarDays,
    },
    {
      label: t("kpiRevenue"),
      value: formatMoney(revenueKpi, intlLocale),
      prefix: "MAD",
      delta: revenueDelta?.text ?? "+8%",
      trend: (revenueDelta?.up ?? true) ? ("up" as const) : ("down" as const),
      iconTint: "bg-tint-green text-tint-fg-green",
      series: live && totals ? totals.sparkRevenue : walkSeries(`spark:rev:${range}:${location}`, 12, 120, 34),
      sparkLabel: t("sparkRevenue"),
      icon: Wallet,
    },
    {
      label: t("kpiUtilization"),
      value: String(utilKpi),
      suffix: "%",
      delta: live ? "" : "+5 pts",
      trend: "up" as const,
      iconTint: "bg-tint-purple text-tint-fg-purple",
      series: live && totals ? totals.spark : walkSeries(`spark:util:${range}:${location}`, 12, 52, 5),
      sparkLabel: t("sparkUtilization"),
      icon: DoorOpen,
    },
    {
      label: t("kpiFillRate"),
      value: String(fillKpi),
      suffix: "%",
      delta: live ? "" : "+9 pts",
      trend: "up" as const,
      iconTint: "bg-tint-amber text-tint-fg-amber",
      series: live && totals ? totals.spark : walkSeries(`spark:fill:${range}:${location}`, 12, 62, 6),
      sparkLabel: t("sparkFillRate"),
      icon: GraduationCap,
    },
  ];

  /* CSV exports: stream from the live, currently-filtered dataset */
  const exportBookings = useCallback(() => {
    // Streams the filtered daily buckets (live data when connected).
    downloadCsv("calendar-bookings-per-day.csv", [
      [t("csvBookingsTitle"), t(CAPTION_KEY[range]), (location === "all" ? t("locationAll") : location === "casa" ? "Casablanca" : "Agadir")],
      [t("csvDate"), t("csvBookings"), t("csvRevenueMad")],
      ...buckets.map((b) => [b.fullLabel, b.count, b.revenue]),
      [t("csvTotal"), totalBookingsInChart, buckets.reduce((s, b) => s + b.revenue, 0)],
    ]);
  }, [buckets, range, location, totalBookingsInChart, t]);

  const exportRevenue = useCallback(() => {
    // Streams the filtered category revenue (live data when connected).
    downloadCsv("calendar-revenue-by-category.csv", [
      [t("csvRevenueTitle"), t(CAPTION_KEY[range]), (location === "all" ? t("locationAll") : location === "casa" ? "Casablanca" : "Agadir")],
      [t("csvCategory"), t("csvRevenueMad"), t("csvShare")],
      ...categoryDataWithShare.map((c) => [c.name, c.value, c.share]),
      [t("csvTotal"), categoryTotal, 100],
    ]);
  }, [categoryDataWithShare, categoryTotal, range, location, t]);

  const exportUtilization = useCallback(() => {
    // Streams utilization per room (live data when connected).
    downloadCsv("calendar-utilization-by-room.csv", [
      [t("csvUtilizationTitle"), t(CAPTION_KEY[range]), (location === "all" ? t("locationAll") : location === "casa" ? "Casablanca" : "Agadir")],
      [t("csvRoom"), t("csvUtilizationPct"), t("csvBookedHours")],
      ...utilData.map((r) => [r.room, r.pct, r.hours]),
    ]);
  }, [utilData, range, location, t]);

  const exportFormations = useCallback(() => {
    // Streams formation performance (live data when connected).
    downloadCsv("calendar-formation-performance.csv", [
      [t("csvFormationsTitle"), t(CAPTION_KEY[range]), (location === "all" ? t("locationAll") : location === "casa" ? "Casablanca" : "Agadir")],
      [t("tableFormation"), t("csvSessions"), t("tableEnrolled"), t("csvCapacity"), t("csvFillPct"), t("csvAttendancePct"), t("csvNoShows")],
      ...formationRows.map((r) => [r.name, r.sessions, r.enrolled, r.capacity, r.fill, r.attendance, r.noShows]),
    ]);
  }, [formationRows, range, location, t]);

  const exportAll = useCallback(() => {
    exportBookings();
    exportRevenue();
    exportUtilization();
    exportFormations();
    showToast(t("fourCsvs"), t("fourCsvsDetail"));
  }, [exportBookings, exportRevenue, exportUtilization, exportFormations, showToast, t]);

  const segmentedButton = (active: boolean) =>
    `segment ${active ? "segment-active" : ""}`;

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.05em] text-obsidian sm:text-[32px]">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-xl text-[14px] font-medium text-obsidian-light">
            {t("subtitle")}
          </p>
        </div>
        <button type="button" onClick={exportAll} className="btn btn-secondary h-11 border border-border bg-white text-[13px]">
          <Download size={16} strokeWidth={2.2} aria-hidden="true" />
          {t("exportAll")}
        </button>
      </div>

      {/* Controls row */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="segmented" role="group" aria-label={t("dateRangeAria")}>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={segmentedButton(range === opt.key)}
              aria-pressed={range === opt.key}
              onClick={() => setRange(opt.key)}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <span className="hidden h-5 w-px bg-divider md:block" aria-hidden="true" />
        <div className="segmented" role="group" aria-label={t("locationAria")}>
          {LOCATION_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={segmentedButton(location === opt.key)}
              aria-pressed={location === opt.key}
              onClick={() => setLocation(opt.key)}
            >
              {opt.key === "all" ? t("locationAll") : opt.key === "casa" ? "Casablanca" : "Agadir"}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Switch
            id="compare-toggle"
            checked={compare}
            onChange={setCompare}
            label={t("vsPrevPeriod")}
            caption={t("vsPrevPeriodCaption")}
          />
        </div>
      </div>

      {/* KPI strip */}
      <section aria-label={t("keyMetricsAria")} className="mt-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
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
          title={t("bookingsPerDay")}
          icon={BarChart3}
          onExport={exportBookings}
          caption={`${rangeCaption} · ${locLabel}. ${live ? t("captionLive") : t("captionDemo")}`}
        >
          <div
            role="img"
            aria-label={t("ariaBookingsChart", { caption: rangeCaption.toLowerCase(), location: locLabel.toLowerCase(), total: totalBookingsInChart, peak: peak.count, peakLabel: peak.fullLabel })}
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
                <Bar dataKey="count" name={t("barBookings")} fill="var(--color-electric)" radius={[5, 5, 0, 0]} maxBarSize={26} />
                {compare && (
                  <Line
                    type="monotone"
                    dataKey="prevCount"
                    name={t("barPreviousPeriod")}
                    stroke="var(--color-muted)"
                    strokeWidth={1.8}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {compare && (
            <div className="mt-2 flex items-center justify-center gap-5 text-[11px] font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-pill bg-electric" />
                {t("thisPeriod")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-0 w-5 border-t-2 border-dashed border-muted" />
                {t("previousPeriod")}
              </span>
            </div>
          )}
        </ChartCard>

        {/* (2) Revenue by category: donut */}
        <ChartCard
          title={t("revenueByCategory")}
          icon={PieChartIcon}
          iconTint="bg-tint-green text-tint-fg-green"
          onExport={exportRevenue}
          caption={t("captionRevenue")}
        >
          <div
            role="img"
            aria-label={
              categoryDataWithShare.length === 0
                ? t("ariaRevenueEmpty", { total: formatMoney(categoryTotal, intlLocale) })
                : t("ariaRevenueChart", {
                    total: formatMoney(categoryTotal, intlLocale),
                    breakdown: categoryDataWithShare.map((c) => `${c.name} ${c.share}%`).join(", "),
                  })
            }
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
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{t("total")}</span>
              <span className="mt-0.5 font-mono text-[15px] font-bold leading-none text-obsidian tabular-nums">
                {formatMoney(categoryTotal, intlLocale)}
              </span>
              <span className="mt-0.5 text-[10px] font-semibold text-muted">MAD</span>
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

        {/* (3) Utilization by room: horizontal bars */}
        <ChartCard
          title={t("utilizationByRoom")}
          icon={DoorOpen}
          iconTint="bg-tint-purple text-tint-fg-purple"
          onExport={exportUtilization}
          caption={t("captionUtilization")}
        >
          <div
            role="img"
            aria-label={t("ariaUtilizationChart", {
              breakdown: utilData.map((r) => t("ariaUtilizationItem", { room: r.room, pct: r.pct })).join(", "),
            })}
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
                  name={t("barUtilization")}
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

        {/* (4) Formation performance: table */}
        <ChartCard
          title={t("formationPerformance")}
          icon={GraduationCap}
          iconTint="bg-tint-green text-tint-fg-green"
          onExport={exportFormations}
          exportDisabled={formationRows.length === 0}
          caption={t("captionFormations")}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left">
              <thead>
                <tr className="border-b border-divider">
                  <th scope="col" className="py-2 pr-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                    {t("tableFormation")}
                  </th>
                  {(["tableSessions", "tableEnrolled", "tableFill", "tableAttendance", "tableNoShows"] as const).map((colKey) => (
                    <th
                      key={colKey}
                      scope="col"
                      className="px-2 py-2 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-muted last:pr-0"
                    >
                      {t(colKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {formationRows.map((row) => (
                  <tr key={row.name} className="transition-colors hover:bg-canvas/70">
                    <th scope="row" className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="whitespace-nowrap text-[12px] font-bold text-obsidian">
                          {row.name}
                        </span>
                        {(row.fill ?? 0) >= 100 && (
                          <span className="chip bg-error-tint text-[10px] font-extrabold uppercase tracking-[0.08em] text-error-fg">
                            {t("full")}
                          </span>
                        )}
                      </span>
                    </th>
                    <td className="px-2 py-2.5 text-right font-mono text-[12px] font-semibold text-obsidian-light tabular-nums">
                      {row.sessions}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[12px] font-semibold text-obsidian-light tabular-nums">
                      {row.enrolled}
                      <span className="text-[11px] text-muted">/{row.capacity}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center justify-end gap-1.5">
                        <span
                          className="h-1.5 w-12 overflow-hidden rounded-pill bg-track"
                          role="progressbar"
                          aria-valuenow={row.fill}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t("fillRateFor", { name: row.name })}
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
                    <td colSpan={6} className="py-8 text-center text-[12px] font-medium text-muted">
                      {location === "all" ? t("noFormationsAllLocations") : t("noFormationsLocation", { location: locLabel })}
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
        {t("footnote")}
      </p>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
