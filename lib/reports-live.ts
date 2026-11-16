/**
 * Reports: live aggregates (server-only).
 * Fetches raw rows; math (bucketing, deltas, utilization) happens on the client
 * so every range/location toggle stays interactive.
 */
import "server-only";
import { getLocale } from "next-intl/server";
import { categoryName } from "@/lib/intl-locale";
import { createClient } from "@/lib/supabase/server";

export interface ReportDay {
  date: string; // yyyy-mm-dd (local, Africa/Casablanca)
  all: [number, number];    // [count, revenue]
  casa: [number, number];
  agadir: [number, number];
}
export interface ReportsLive {
  live: true;
  daily: ReportDay[];
  byCategory: Array<{ name: string; color: string; revenue: number }>;
  byRoom: Array<{ room: string; pct: number; hours: number; location: "casa" | "agadir" }>;
  formations: Array<{ name: string; sessions: number; enrolled: number; capacity: number; fill: number; attendance: number; noShows: number; location: "casa" | "agadir" }>;
  newClientsByDays: { casa: number; agadir: number; all: number };
}

const DAYS = 210;

function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function loadReports(): Promise<ReportsLive | null> {
  const locale = await getLocale();
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const since = new Date();
    since.setDate(since.getDate() - (DAYS - 1));
    since.setHours(0, 0, 0, 0);

    const [
      { data: bookings, error: bErr },
      { data: rooms, error: rErr },
      { data: wh, error: wErr },
      { data: categories, error: cErr },
      { data: clients, error: clErr },
      { data: formationRows, error: fErr },
      { data: participantRows, error: pErr },
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,type,category_id,room_id,starts_at,ends_at,status,price")
        .gte("starts_at", since.toISOString())
        .not("status", "in", "(cancelled,paused)")
        .limit(10000),
      supabase.from("rooms").select("id,name,location,is_active,capacity,hourly_rate"),
      supabase.from("working_hours").select("weekday,is_open,open_time,close_time"),
      supabase.from("categories").select("id,name_en,name_fr,color,sort").order("sort"),
      supabase.from("clients").select("id,created_at,city").gte("created_at", since.toISOString()),
      supabase.from("formations").select("booking_id,capacity"),
      supabase.from("formation_participants").select("booking_id,status,waitlist"),
    ]);
    if (bErr || rErr || wErr || cErr || clErr || fErr || pErr) {
      throw (bErr ?? rErr ?? wErr ?? cErr ?? clErr ?? fErr ?? pErr);
    }

    const roomById = new Map((rooms ?? []).map((r) => [r.id as string, r]));
    const categoryById = new Map((categories ?? []).map((c) => [c.id as string, c]));
    const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const openMinutesByWeekday = new Map<string, number>(
      (wh ?? []).map((w) => [
        w.weekday as string,
        w.is_open ? Math.max(0, (Number(String(w.close_time).slice(0, 2)) * 60 + Number(String(w.close_time).slice(3, 5))) - (Number(String(w.open_time).slice(0, 2)) * 60 + Number(String(w.open_time).slice(3, 5)))) : 0,
      ]),
    );

    // daily series (all + per location), zero-filled
    const dailyMap = new Map<string, { all: [number, number]; casa: [number, number]; agadir: [number, number] }>();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      dailyMap.set(localDay(d), { all: [0, 0], casa: [0, 0], agadir: [0, 0] });
    }
    const categoryRevenue = new Map<string, number>();
    const roomBookedMinutes = new Map<string, number>();
    for (const b of bookings ?? []) {
      const day = localDay(new Date(b.starts_at as string));
      const bucket = dailyMap.get(day);
      const price = Number(b.price ?? 0);
      const roomLoc = b.room_id ? roomById.get(b.room_id as string)?.location : null;
      const loc: "casa" | "agadir" | null =
        roomLoc === "Agadir" ? "agadir" : roomLoc ? "casa" : null;
      if (bucket) {
        bucket.all[0] += 1;
        bucket.all[1] += price;
        if (loc) {
          bucket[loc][0] += 1;
          bucket[loc][1] += price;
        }
      }
      categoryRevenue.set(
        (b.category_id as string) ?? "uncategorized",
        (categoryRevenue.get((b.category_id as string) ?? "uncategorized") ?? 0) + price,
      );
      if (b.room_id) {
        const mins = Math.max(
          0,
          Math.round((new Date(b.ends_at as string).getTime() - new Date(b.starts_at as string).getTime()) / 60000),
        );
        roomBookedMinutes.set(
          b.room_id as string,
          (roomBookedMinutes.get(b.room_id as string) ?? 0) + mins,
        );
      }
    }

    const daily: ReportDay[] = [...dailyMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, ...v }));

    const TINT: Record<string, string> = {
      blue: "var(--color-electric)",
      green: "var(--color-success)",
      purple: "var(--color-tint-fg-purple)",
      amber: "var(--color-warning)",
      teal: "var(--color-tint-fg-teal)",
      rose: "var(--color-tint-fg-rose)",
    };
    const byCategory = [...categoryRevenue.entries()]
      .map(([id, revenue]) => ({
        name: categoryName(categoryById.get(id), locale) || "Other",
        color: TINT[categoryById.get(id)?.color ?? "blue"] ?? "var(--color-electric)",
        revenue: Math.round(revenue),
      }))
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // room utilization vs available minutes in the window
    const totalDaysOpen = new Map<string, number>();
    for (const [weekday, mins] of openMinutesByWeekday) {
      const dayIdx = DAY_NAMES.indexOf(weekday as (typeof DAY_NAMES)[number]);
      if (dayIdx === -1 || mins === 0) continue;
      let count = 0;
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        if (d.getDay() === dayIdx) count += 1;
      }
      totalDaysOpen.set(weekday, mins * count);
    }
    const minutesPerOpenWeek = [...totalDaysOpen.values()].reduce((a, b) => a + b, 0);
    const byRoom = (rooms ?? [])
      .filter((r) => r.is_active !== false)
      .map((r) => {
        const booked = roomBookedMinutes.get(r.id as string) ?? 0;
        const available = minutesPerOpenWeek;
        return {
          room: r.name as string,
          pct: available > 0 ? Math.min(100, Math.round((booked / available) * 100)) : 0,
          hours: Math.round(booked / 60),
          location: (r.location === "Agadir" ? "agadir" : "casa") as "casa" | "agadir",
        };
      })
      .sort((a, b) => b.pct - a.pct);

    // formation performance (group repeated sessions by title)
    const capacityByBooking = new Map((formationRows ?? []).map((f) => [f.booking_id as string, Number(f.capacity)]));
    const participantsByBooking = new Map<string, typeof participantRows>();
    for (const p of participantRows ?? []) {
      const key = p.booking_id as string;
      const list = participantsByBooking.get(key) ?? [];
      list.push(p);
      participantsByBooking.set(key, list);
    }
    // group by title
    const { data: formationBookings } = await supabase
      .from("bookings")
      .select("id,title,room_id,starts_at")
      .eq("type", "formation")
      .not("status", "in", "(cancelled,paused)");
    const byTitle = new Map<string, { sessions: number; enrolled: number; capacity: number; attended: number; noShows: number; location: "casa" | "agadir" }>();
    for (const b of formationBookings ?? []) {
      const participants = participantsByBooking.get(b.id as string) ?? [];
      const active = participants.filter((p) => !p.waitlist && p.status !== "cancelled");
      const attended = active.filter((p) => p.status === "attended").length;
      const noShows = active.filter((p) => p.status === "no_show").length;
      const cap = capacityByBooking.get(b.id as string) ?? 0;
      const roomLoc = b.room_id ? roomById.get(b.room_id as string)?.location : null;
      const loc: "casa" | "agadir" = roomLoc === "Agadir" ? "agadir" : "casa";
      const cur = byTitle.get(b.title as string) ?? { sessions: 0, enrolled: 0, capacity: 0, attended: 0, noShows: 0, location: loc };
      cur.sessions += 1;
      cur.enrolled += active.length;
      cur.capacity += cap;
      cur.attended += attended;
      cur.noShows += noShows;
      byTitle.set(b.title as string, cur);
    }
    const formations = [...byTitle.entries()].map(([name, f]) => ({
      name,
      sessions: f.sessions,
      enrolled: f.enrolled,
      capacity: f.capacity,
      fill: f.capacity > 0 ? Math.min(100, Math.round((f.enrolled / f.capacity) * 100)) : 0,
      attendance: f.enrolled > 0 ? Math.round((f.attended / f.enrolled) * 100) : 0,
      noShows: f.noShows,
      location: f.location,
    }));

    const clientCity = (clients ?? []).map((c) => String((c as { city?: string | null }).city ?? "").toLowerCase());
    const newClientsByDays = {
      all: (clients ?? []).length,
      casa: clientCity.filter((c) => c.includes("casablanca")).length,
      agadir: clientCity.filter((c) => c.includes("agadir")).length,
    };

    return { live: true, daily, byCategory, byRoom, formations, newClientsByDays };
  } catch (e) {
    console.error("[reports] live load failed:", e);
    return null;
  }
}
