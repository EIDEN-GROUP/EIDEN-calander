/**
 * CALENDAR. — booking/change-request transactional emails.
 * Best-effort: never throws, never blocks the mutation it accompanies.
 * Logs failures to the server console.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bookingCreated,
  bookingUpdated,
  bookingCancelled,
  changeRequestReceived,
  changeRequestApproved,
  changeRequestDeclined,
  changeRequestExpired,
  type BookingLike,
} from "@/lib/email/templates";
import { sendMail } from "@/lib/email/send";
import type { BookingStatus } from "@/lib/types/db";

export type BookingEvent = "created" | "updated" | "cancelled";
export type ChangeRequestEvent = "received" | "approved" | "declined" | "expired";

interface BookingRowPick {
  title: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  status: string | null;
  client_id: string | null;
  room_id: string | null;
}

async function loadMailContext(
  supabase: SupabaseClient,
  booking: BookingRowPick,
): Promise<{
  clientEmail: string | null;
  room: { name: string; location: string; capacity?: number };
}> {
  let clientEmail: string | null = null;
  if (booking.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("email")
      .eq("id", booking.client_id)
      .maybeSingle();
    clientEmail = (client?.email as string | null) ?? null;
  }

  let room = { name: "Unassigned room", location: "", capacity: undefined as number | undefined };
  if (booking.room_id) {
    const { data: roomRow } = await supabase
      .from("rooms")
      .select("name,location,capacity")
      .eq("id", booking.room_id)
      .maybeSingle();
    if (roomRow?.name) {
      room = {
        name: String(roomRow.name).replace(/\s*\(DEMO\)\s*$/, ""),
        location: String(roomRow.location ?? ""),
        capacity: roomRow.capacity != null ? Number(roomRow.capacity) : undefined,
      };
    }
  }
  return { clientEmail, room };
}

/** Email the attached client about a booking lifecycle event. Silent when no client email. */
export async function notifyBookingEvent(
  supabase: SupabaseClient,
  bookingId: string,
  event: BookingEvent,
): Promise<void> {
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("title,starts_at,ends_at,notes,status,client_id,room_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;

    const { clientEmail, room } = await loadMailContext(supabase, booking as BookingRowPick);
    if (!clientEmail) {
      console.log(`[notify] booking ${event} — no client email attached to booking ${bookingId}, skipping`);
      return;
    }

    const locale = "en" as const;
    const bookingLike: BookingLike = {
      title: booking.title as string,
      starts_at: booking.starts_at as string,
      ends_at: booking.ends_at as string,
      notes: (booking.notes as string | null) ?? undefined,
      status: (booking.status as BookingStatus | null) ?? undefined,
    };
    const rendered =
      event === "created"
        ? bookingCreated({ booking: bookingLike, room, locale })
        : event === "updated"
          ? bookingUpdated({ booking: bookingLike, room, locale })
          : bookingCancelled({ booking: bookingLike, room, locale });

    const result = await sendMail({
      to: clientEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    if (!result.ok) console.error(`[notify] booking ${event} → ${clientEmail} failed:`, result.error?.message);
  } catch (err) {
    console.error("[notify] booking event failed (non-fatal)", err);
  }
}

/** Email the right participant about a change-request lifecycle event. */
export async function notifyChangeRequestEvent(
  supabase: SupabaseClient,
  requestId: string,
  event: ChangeRequestEvent,
): Promise<void> {
  try {
    const { data: cr } = await supabase
      .from("change_requests")
      .select(
        "id,status,new_booking_id,conflicting_booking_id,requested_by,assigned_to,response_message,suggested_slots",
      )
      .eq("id", requestId)
      .maybeSingle();
    if (!cr) return;

    // Resolve room (from the incumbent's booking — both bookings almost always share the room)
    let roomName = "your room";
    if (cr.conflicting_booking_id) {
      const { data: oldB } = await supabase
        .from("bookings")
        .select("room_id")
        .eq("id", cr.conflicting_booking_id)
        .maybeSingle();
      if (oldB?.room_id) {
        const { data: roomRow } = await supabase
          .from("rooms")
          .select("name")
          .eq("id", oldB.room_id)
          .maybeSingle();
        if (roomRow?.name) roomName = String(roomRow.name).replace(/\s*\(DEMO\)\s*$/, "");
      }
    }

    const [requesterProfile, incumbentProfile] = await Promise.all([
      supabase.from("profiles").select("full_name,locale,email").eq("id", cr.requested_by).maybeSingle(),
      supabase.from("profiles").select("full_name,locale,email").eq("id", cr.assigned_to).maybeSingle(),
    ]);
    const requesterName = (requesterProfile.data?.full_name as string) ?? "Your colleague";
    const incumbentName = (incumbentProfile.data?.full_name as string) ?? "the organizer";

    // Slot label: from the new booking's times
    let slot = "the requested time";
    if (cr.new_booking_id) {
      const { data: newB } = await supabase
        .from("bookings")
        .select("starts_at,ends_at")
        .eq("id", cr.new_booking_id)
        .maybeSingle();
      if (newB?.starts_at) {
        const d = new Date(newB.starts_at as string);
        const end = new Date(newB.ends_at as string);
        slot = `${d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} → ${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
      }
    }

    const suggestedCount = Array.isArray(cr.suggested_slots) ? cr.suggested_slots.length : 0;
    const locale = (requesterProfile.data?.locale === "fr" ? "fr" : "en") as "en" | "fr";
    const responseMessage = (cr.response_message as string | null) ?? undefined;

    if (event === "received") {
      const to = (incumbentProfile.data?.email as string | null) ?? null;
      if (!to) {
        console.log(`[notify] change-request received — no email for incumbent ${cr.assigned_to}`);
        return;
      }
      const rendered = changeRequestReceived({
        incumbentName,
        requesterName,
        room: roomName,
        slot,
        suggested: suggestedCount,
        locale,
      });
      const result = await sendMail({ to, subject: rendered.subject, text: rendered.text, html: rendered.html });
      if (!result.ok) console.error("[notify] change-request received failed:", result.error?.message);
      return;
    }

    const to = (requesterProfile.data?.email as string | null) ?? null;
    if (!to) {
      console.log(`[notify] change-request ${event} — no email for requester ${cr.requested_by}`);
      return;
    }
    if (event === "approved") {
      const rendered = changeRequestApproved({ requesterName, room: roomName, slot, responseMessage, locale });
      const result = await sendMail({ to, subject: rendered.subject, text: rendered.text, html: rendered.html });
      if (!result.ok) console.error("[notify] change-request approved failed:", result.error?.message);
      return;
    }
    if (event === "declined") {
      const rendered = changeRequestDeclined({ requesterName, room: roomName, slot, responseMessage, locale });
      const result = await sendMail({ to, subject: rendered.subject, text: rendered.text, html: rendered.html });
      if (!result.ok) console.error("[notify] change-request declined failed:", result.error?.message);
      return;
    }
    const rendered = changeRequestExpired({ requesterName, room: roomName, slot, locale });
    const result = await sendMail({ to, subject: rendered.subject, text: rendered.text, html: rendered.html });
    if (!result.ok) console.error("[notify] change-request expired failed:", result.error?.message);
  } catch (err) {
    console.error("[notify] change-request event failed (non-fatal)", err);
  }
}
