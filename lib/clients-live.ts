/**
 * Clients: live data loader (server-only). Null on unconfigured/error.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BookingRow, ClientRow } from "@/lib/types/db";

export interface ClientsListData {
  live: boolean;
  clients: ClientRow[];
  bookings: BookingRow[];
}

export interface ClientDetailData extends ClientsListData {
  client: ClientRow;
}

export async function loadClients(): Promise<ClientsListData | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const [clients, bookings] = await Promise.all([
      supabase
        .from("clients")
        .select("id,type,full_name,company,email,phone,address,city,tags,status,source,notes,anonymized_at,deleted_at,created_at")
        .is("deleted_at", null)
        .order("full_name")
        .limit(500),
      supabase.from("bookings").select("id,type,title,category_id,room_id,client_id,created_by,starts_at,ends_at,status,price,notes").limit(2000),
    ]);
    if (clients.error) throw clients.error;
    if (bookings.error) throw bookings.error;
    return { live: true, clients: (clients.data ?? []) as ClientRow[], bookings: (bookings.data ?? []) as BookingRow[] };
  } catch (e) {
    console.error("[clients] live load failed:", e);
    return null;
  }
}

export async function loadClient(id: string): Promise<ClientDetailData | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data: client, error } = await supabase
      .from("clients")
      .select("id,type,full_name,company,email,phone,address,city,tags,status,source,notes,anonymized_at,deleted_at,created_at")
      .eq("id", id)
      .single();
    if (error || !client) return null;
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("id,type,title,category_id,room_id,client_id,created_by,starts_at,ends_at,status,price,notes")
      .eq("client_id", id)
      .order("starts_at", { ascending: false })
      .limit(200);
    if (bErr) throw bErr;
    return {
      live: true,
      client: client as ClientRow,
      clients: [client as ClientRow],
      bookings: (bookings ?? []) as BookingRow[],
    };
  } catch (e) {
    console.error("[clients] live load failed:", e);
    return null;
  }
}
