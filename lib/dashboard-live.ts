/**
 * Dashboard — live data loader (server-only).
 * Everything the overview needs in one shot; falls back to null on error/unconfigured.
 */
import "server-only";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { appLocaleTag } from "@/lib/intl-locale";

export interface DashboardData {
  live: true;
  todayLong: string;
  kpis: {
    todayBookings: number;
    weekUtilization: number;
    formationFillRate: number;
    pendingChangeRequests: number;
  };
  /** rooms × the current week grid */
  grid: {
    rooms: Array<{ id: string; name: string; location: string }>;
    days: Array<{ label: string; date: number; isToday: boolean; weekend: boolean }>;
    events: Array<{ day: number; roomId: string | null; time: string; title: string; tone: "blue" | "green" | "purple" | "amber" }>;
  };
  futureEvents: Array<{ day: string; time: string; title: string; meta: string; chip: string }>;
  plansInFlight: Array<{ title: string; tasks: string; pct: number }>;
  utilization: Array<{ room: string; pct: number }>;
  firstName: string;
}

export async function loadDashboard(): Promise<DashboardData | null> {
  const locale = await getLocale();
  const tag = appLocaleTag(locale);
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    // Current week (Mon-first)
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    const weekStart = days[0].toISOString();
    const weekEnd = new Date(days[6].getTime() + 86400000).toISOString();

    const [
      { data: profile },
      { data: bookings, error: bErr },
      { data: rooms, error: rErr },
      { data: categories },
      { data: formations },
      { data: participants },
      { data: plans },
      { data: planTasks },
      { data: changeRequests },
      { data: openParticipants },
    ] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle(),
      supabase.from("bookings").select("id,type,title,category_id,room_id,client_id,starts_at,ends_at,status,price").gte("starts_at", weekStart).lt("starts_at", weekEnd).limit(2000),
      supabase.from("rooms").select("id,name,location,capacity,is_active,sort").eq("is_active", true).order("sort"),
      supabase.from("categories").select("id,type,color"),
      supabase.from("formations").select("booking_id,capacity"),
      supabase.from("formation_participants").select("booking_id,status,waitlist"),
      supabase.from("plans").select("id,title,status,progress").eq("status", "active").order("target_date", { ascending: true, nullsFirst: false }).limit(4),
      supabase.from("plan_tasks").select("plan_id,status"),
      supabase.from("change_requests").select("id,status,created_at").eq("status", "pending"),
      supabase.from("formation_participants").select("booking_id,status,waitlist"),
    ]);
    if (bErr) throw bErr;
    if (rErr) throw rErr;

    const categoryType = new Map((categories ?? []).map((c) => [c.id as string, (c as { type: string }).type]));
    const formationBookingIds = new Set((formations ?? []).map((f) => f.booking_id as string));
    const activeParticipants = new Map<string, number>();
    for (const p of participants ?? []) {
      if (p.waitlist || p.status === "cancelled") continue;
      activeParticipants.set(p.booking_id as string, (activeParticipants.get(p.booking_id as string) ?? 0) + 1);
    }
    const totalSeats = (formations ?? []).reduce((s, f) => s + Number(f.capacity ?? 0), 0);
    const totalEnrolled = (formations ?? []).reduce((s, f) => s + (activeParticipants.get(f.booking_id as string) ?? 0), 0);

    // grid events this week — paused bookings still render (in hold style)
    const events = (bookings ?? [])
      .filter((b) => b.status !== "cancelled")
      .map((b) => {
        const d = new Date(b.starts_at as string);
        const dayIdx = days.findIndex((dd) => dd.toDateString() === d.toDateString());
        const catType = categoryType.get(b.category_id as string);
        const isFormation = b.type === "formation" || catType === "formation" || formationBookingIds.has(b.id as string);
        const tone: "blue" | "green" | "purple" | "amber" =
          b.status === "pending_conflict" || b.status === "paused" ? "amber" : isFormation ? "green" : catType === "formation" ? "green" : "purple";
        return {
          day: dayIdx,
          roomId: (b.room_id as string | null) ?? null,
          time: d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" }),
          title: (b.title as string) ?? "Booking",
          tone,
        };
      })
      .filter((e) => e.day >= 0);

    // utilization this week: booked minutes / available
    const { data: wh } = await supabase.from("working_hours").select("weekday,is_open,open_time,close_time");
    const openMinByWeekday = new Map<string, number>();
    for (const w of wh ?? []) {
      if (!w.is_open) { openMinByWeekday.set(w.weekday as string, 0); continue; }
      const [oh, om] = String(w.open_time).split(":").map(Number);
      const [ch, cm] = String(w.close_time).split(":").map(Number);
      openMinByWeekday.set(w.weekday as string, (ch * 60 + cm) - (oh * 60 + om));
    }
    const dayIdxNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const availableMin = days.reduce((sum, d) => {
      const key = dayIdxNames[d.getDay()];
      return sum + (openMinByWeekday.get(key) ?? 0);
    }, 0) * Math.max(rooms?.length ?? 1, 1);
    const bookedMin = (bookings ?? [])
      .filter((b) => b.status !== "cancelled" && b.status !== "paused")
      .reduce((sum, b) => sum + Math.max(0, (new Date(b.ends_at as string).getTime() - new Date(b.starts_at as string).getTime()) / 60000), 0);
    const weekUtilization = availableMin > 0 ? Math.round((bookedMin / availableMin) * 100) : 0;

    // plans widget
    const taskByPlan = new Map<string, { done: number; total: number }>();
    for (const t of planTasks ?? []) {
      const key = t.plan_id as string;
      const cur = taskByPlan.get(key) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      taskByPlan.set(key, cur);
    }
    const plansInFlight = (plans ?? []).slice(0, 4).map((p) => {
      const agg = taskByPlan.get(p.id as string);
      const pct = agg && agg.total > 0 ? Math.round((agg.done / agg.total) * 100) : Number(p.progress ?? 0);
      return {
        title: (p.title as string) ?? "Untitled plan",
        tasks: agg ? `${agg.done}/${agg.total} tasks` : "No tasks yet",
        pct,
      };
    });

    // future events (next 3 from today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const upcoming = (bookings ?? [])
      .filter((b) => b.status !== "cancelled" && b.status !== "paused" && new Date(b.starts_at as string) >= todayStart)
      .sort((a, b) => new Date(a.starts_at as string).getTime() - new Date(b.starts_at as string).getTime())
      .slice(0, 3);
    const futureEvents = upcoming.map((b) => {
      const d = new Date(b.starts_at as string);
      const isToday = d.toDateString() === now.toDateString();
      const label = isToday ? "Today" : d.toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short" });
      return {
        day: label,
        time: `${d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" })} – ${new Date(b.ends_at as string).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" })}`,
        title: (b.title as string) ?? "Booking",
        meta: b.type === "formation" ? "Formation" : "Booking",
        chip: isToday ? "Today" : label,
      };
    });

    // room utilization bars this week (per room, by booked minutes)
    const roomBooked = new Map<string, number>();
    for (const b of bookings ?? []) {
      if (b.status === "cancelled" || b.status === "paused") continue;
      const key = (b.room_id as string | null) ?? "offsite";
      roomBooked.set(key, (roomBooked.get(key) ?? 0) + Math.max(0, (new Date(b.ends_at as string).getTime() - new Date(b.starts_at as string).getTime()) / 60000));
    }
    const weeklyAvailablePerRoom = Math.max(
      1,
      days.reduce((sum, d) => sum + (openMinByWeekday.get(dayIdxNames[d.getDay()]) ?? 0), 0),
    );
    const utilization = (rooms ?? []).slice(0, 4).map((r) => ({
      room: (r.name as string).replace(/\s*\(DEMO\)\s*$/, ""),
      pct: Math.min(100, Math.round(((roomBooked.get(r.id as string) ?? 0) / weeklyAvailablePerRoom) * 100)),
    }));

    const firstName = ((profile?.full_name as string) ?? "Eiden").split(" ")[0] || "Eiden";

    return {
      live: true,
      todayLong: now.toLocaleDateString(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      kpis: {
        todayBookings: (bookings ?? []).filter((b) => b.status !== "cancelled" && b.status !== "paused" && new Date(b.starts_at as string).toDateString() === now.toDateString()).length,
        weekUtilization,
        formationFillRate: totalSeats > 0 ? Math.round((totalEnrolled / totalSeats) * 100) : 0,
        pendingChangeRequests: (changeRequests ?? []).length + (openParticipants ? 0 : 0),
      },
      grid: {
        rooms: (rooms ?? []).map((r) => ({ id: r.id as string, name: (r.name as string).replace(/\s*\(DEMO\)\s*$/, ""), location: (r.location as string) ?? "Casablanca" })),
        days: days.map((d) => ({
          label: d.toLocaleDateString(tag, { weekday: "short" }),
          date: d.getDate(),
          isToday: d.toDateString() === now.toDateString(),
          weekend: d.getDay() === 0 || d.getDay() === 6,
        })),
        events,
      },
      futureEvents,
      plansInFlight,
      utilization,
      firstName,
    };
  } catch (e) {
    console.error("[dashboard] live load failed:", e);
    return null;
  }
}
