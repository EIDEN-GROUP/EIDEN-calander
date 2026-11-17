/**
 * CALENDAR. · live data loader (server-only).
 * Every page that wants live Supabase data calls this; on any failure
 * (or missing env) it falls back to DEMO data with live:false so the UI
 * never white-screens.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_CATEGORIES,
  DEMO_CLIENTS,
  DEMO_ROOMS,
  getDemoBookings,
} from "@/lib/demo-data";
import type {
  BookingRow,
  CategoryRow,
  ClientRow,
  RoomRow,
} from "@/lib/types/db";
import type { WorkingHoursEntry } from "@/lib/slots";

export interface CalendarData {
  live: boolean;
  rooms: RoomRow[];
  categories: CategoryRow[];
  clients: ClientRow[];
  bookings: BookingRow[];
  workingHours: WorkingHoursEntry[];
  /** id → display name for staff who appear in booking records. */
  staff: Record<string, string>;
  error?: string;
}

const DEFAULT_WH: WorkingHoursEntry[] = [
  { weekday: "mon", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "tue", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "wed", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "thu", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "fri", is_open: true, open_time: "08:00", close_time: "20:00" },
  { weekday: "sat", is_open: true, open_time: "09:00", close_time: "13:00" },
  { weekday: "sun", is_open: false, open_time: "00:00", close_time: "00:00" },
];

export async function loadCalendarData(): Promise<CalendarData> {
  const supabase = await createClient();
  if (!supabase) {
    return { live: false, rooms: DEMO_ROOMS, categories: DEMO_CATEGORIES, clients: DEMO_CLIENTS, bookings: getDemoBookings(), workingHours: DEFAULT_WH, staff: {} };
  }
  try {
    const [rooms, categories, clients, bookings, wh, staff] = await Promise.all([
      supabase.from("rooms").select("id,name,location,capacity,hourly_rate,currency,amenities,is_active,sort,notes").order("sort"),
      supabase.from("categories").select("id,name_en,name_fr,color,icon,type,is_system,is_active,sort").order("sort"),
      supabase.from("clients").select("id,type,full_name,company,email,phone,address,city,tags,status,source,notes,anonymized_at,deleted_at").is("deleted_at", null).order("full_name").limit(500),
      supabase.from("bookings").select("id,type,title,category_id,room_id,client_id,created_by,starts_at,ends_at,status,price,notes").order("starts_at", { ascending: true }).limit(2000),
      supabase.from("working_hours").select("weekday,is_open,open_time,close_time"),
      supabase.from("profiles").select("id,full_name"),
    ]);

    const err = rooms.error ?? categories.error ?? clients.error ?? bookings.error ?? wh.error ?? staff.error;
    if (err) throw err;

    return {
      live: true,
      rooms: (rooms.data ?? []) as RoomRow[],
      categories: (categories.data ?? []) as CategoryRow[],
      clients: (clients.data ?? []) as ClientRow[],
      bookings: (bookings.data ?? []) as BookingRow[],
      workingHours: (wh.data ?? []) as WorkingHoursEntry[],
      staff: Object.fromEntries((staff.data ?? []).map((r) => [r.id as string, (r.full_name as string) ?? "Someone"])),
    };
  } catch (e) {
    console.error("[live-data] falling back to demo:", e);
    return {
      live: false,
      rooms: DEMO_ROOMS,
      categories: DEMO_CATEGORIES,
      clients: DEMO_CLIENTS,
      bookings: getDemoBookings(),
      workingHours: DEFAULT_WH,
      staff: {},
      error: "Database unreachable: showing demo data",
    };
  }
}
