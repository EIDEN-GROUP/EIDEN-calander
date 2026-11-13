/**
 * Formations — live view-model loader (server-only).
 * Returns FormationVM[] ready for the client, or null when unconfigured/error.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FormationVM } from "@/components/formations/model";
import type {
  BookingRow,
  ClientRow,
  FormationParticipantRow,
  FormationRow,
  RoomRow,
} from "@/lib/types/db";

export interface FormationListData {
  live: boolean;
  vms: FormationVM[];
  rooms: RoomRow[];
  clients: ClientRow[];
  categories: import("@/lib/types/db").CategoryRow[];
}

async function loadRoomsAndClients(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>) {
  const [rooms, clients, categories] = await Promise.all([
    supabase.from("rooms").select("*").order("sort"),
    supabase.from("clients").select("id,type,full_name,company,email,phone,address,city,tags,status,source,notes,anonymized_at,deleted_at").is("deleted_at", null).limit(500),
    supabase.from("categories").select("id,name_en,name_fr,color,icon,type,is_system,is_active,sort").order("sort"),
  ]);
  if (rooms.error) throw rooms.error;
  if (clients.error) throw clients.error;
  if (categories.error) throw categories.error;
  return { rooms: (rooms.data ?? []) as RoomRow[], clients: (clients.data ?? []) as ClientRow[], categories: (categories.data ?? []) as import("@/lib/types/db").CategoryRow[] };
}

export async function loadFormations(): Promise<FormationListData | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { rooms, clients, categories } = await loadRoomsAndClients(supabase);
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("type", "formation")
      .order("starts_at", { ascending: true })
      .limit(500);
    if (bErr) throw bErr;
    const ids = (bookings ?? []).map((b) => b.id as string);
    const [formations, participants] = await Promise.all([
      ids.length ? supabase.from("formations").select("*").in("booking_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("formation_participants").select("*").in("booking_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    if (formations.error) throw formations.error;
    if (participants.error) throw participants.error;

    const formationById = new Map((formations.data ?? []).map((f) => [f.booking_id as string, f as FormationRow]));
    const participantsByBooking = new Map<string, FormationParticipantRow[]>();
    for (const p of participants.data ?? []) {
      const key = p.booking_id as string;
      const list = participantsByBooking.get(key) ?? [];
      list.push(p as FormationParticipantRow);
      participantsByBooking.set(key, list);
    }

    const vms: FormationVM[] = [];
    for (const b of bookings ?? []) {
      const formation = formationById.get(b.id as string);
      if (!formation) continue;
      const booking = b as BookingRow;
      vms.push({
        booking,
        formation: booking.status === "cancelled" ? { ...formation, status: "cancelled" } : formation,
        participants: participantsByBooking.get(b.id as string) ?? [],
      });
    }
    return { live: true, vms, rooms, clients, categories };
  } catch (e) {
    console.error("[formations] live load failed:", e);
    return null;
  }
}

export async function loadFormation(id: string): Promise<FormationListData | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { rooms, clients, categories } = await loadRoomsAndClients(supabase);
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .eq("type", "formation")
      .single();
    if (bErr || !booking) return null;
    const [{ data: formation, error: fErr }, { data: participants, error: pErr }] = await Promise.all([
      supabase.from("formations").select("*").eq("booking_id", id).single(),
      supabase.from("formation_participants").select("*").eq("booking_id", id).order("enrolled_at"),
    ]);
    if (fErr || !formation) return null;
    if (pErr) throw pErr;
    const b = booking as BookingRow;
    const f = formation as FormationRow;
    return {
      live: true,
      rooms,
      clients,
      categories,
      vms: [{
        booking: b,
        formation: b.status === "cancelled" ? { ...f, status: "cancelled" } : f,
        participants: (participants ?? []) as FormationParticipantRow[],
      }],
    };
  } catch (e) {
    console.error("[formations] live load failed:", e);
    return null;
  }
}
