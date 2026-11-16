import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RequestThread, type LiveChangeRequest } from "@/components/bookings/RequestThread";
import { createClient } from "@/lib/supabase/server";
import type { BookingRow } from "@/lib/types/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("requests");
  return { title: t("detailTitle") };
}
// Reads live data at request time — block prerender.
export const instant = false;

async function loadLiveRequest(
  id: string,
  translate: (key: string) => string,
): Promise<LiveChangeRequest | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: cr, error } = await supabase
    .from("change_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !cr) return null;

  const [newB, oldB] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", cr.new_booking_id).single(),
    supabase.from("bookings").select("*").eq("id", cr.conflicting_booking_id).single(),
  ]);
  if (newB.error || oldB.error || !newB.data || !oldB.data) return null;

  const [reqProfile, assProfile] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", cr.requested_by).single(),
    supabase.from("profiles").select("full_name").eq("id", cr.assigned_to).single(),
  ]);

  let roomName: string | null = null;
  let roomLocation: string | null = null;
  const roomId = newB.data.room_id ?? oldB.data.room_id;
  if (roomId) {
    const { data: room } = await supabase.from("rooms").select("name,location").eq("id", roomId).single();
    roomName = room?.name?.replace(/\s*\(DEMO\)\s*$/, "") ?? null;
    roomLocation = room?.location ?? null;
  }

  let clientName: string | null = null;
  if (newB.data.client_id) {
    const { data: client } = await supabase.from("clients").select("full_name").eq("id", newB.data.client_id).single();
    clientName = client?.full_name ?? null;
  }

  return {
    id: cr.id as string,
    status: cr.status as LiveChangeRequest["status"],
    message: (cr.message as string | null) ?? null,
    responseMessage: (cr.response_message as string | null) ?? null,
    createdAt: cr.created_at as string,
    expiresAt: cr.expires_at as string,
    suggestedSlots: Array.isArray(cr.suggested_slots)
      ? (cr.suggested_slots as Array<{ starts_at: string; ends_at: string }>).map((s) => ({
          startsAt: s.starts_at,
          endsAt: s.ends_at,
        }))
      : [],
    newBooking: newB.data as BookingRow,
    conflictingBooking: oldB.data as BookingRow,
    requesterName: (reqProfile.data?.full_name as string) ?? translate("requesterFallback"),
    incumbentName: (assProfile.data?.full_name as string) ?? translate("incumbentFallback"),
    clientName,
    roomName,
    roomLocation,
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const serverNow = new Date().toISOString();
  const t = await getTranslations("requests");

  if (id === "demo") {
    return <RequestThread changeRequestId="demo" serverNow={serverNow} live={null} />;
  }

  const live = await loadLiveRequest(id, (key) => t(key));
  if (!live) notFound();
  return <RequestThread changeRequestId={id} serverNow={serverNow} live={live} />;
}
