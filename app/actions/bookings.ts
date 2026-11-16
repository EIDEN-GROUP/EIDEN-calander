"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { findOverlaps, type OverlapCandidate } from "@/lib/conflict";
import { notifyBookingEvent, notifyChangeRequestEvent } from "@/lib/email/notify";
import { suggestSlots, type WorkingHoursEntry } from "@/lib/slots";
import type { ActionResult, BookingRow, BookingStatus } from "@/lib/types/db";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T/, "Expected ISO date");

const bookingInput = z.object({
  title: z.string().trim().min(2).max(200),
  type: z.enum(["standard", "formation"]).default("standard"),
  categoryId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  startsAt: isoDate,
  endsAt: isoDate,
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type BookingInput = z.infer<typeof bookingInput>;

function notConfigured<T>(): ActionResult<T> {
  return { ok: false, error: { code: "not_configured", message: "Supabase isn't configured — set .env (see docs/RUNBOOK.md)." } };
}
function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}
function failUnexpected(err: unknown): ActionResult<never> {
  console.error("[action] unexpected error", err);
  return { ok: false, error: { code: "unexpected", message: "Something went wrong on our side. Please try again." } };
}
const ACTIVE = ["confirmed", "pending_conflict"] as const;

async function loadRoomWindow(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  roomId: string,
  from: string,
  to: string,
): Promise<OverlapCandidate[]> {
  const { data } = await supabase
    .from("bookings")
    .select("id, room_id, starts_at, ends_at, status, title, created_by")
    .eq("room_id", roomId)
    .in("status", [...ACTIVE])
    .lt("starts_at", to)
    .gt("ends_at", from);
  return (data ?? []) as OverlapCandidate[];
}

async function loadWorkingHours(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
): Promise<WorkingHoursEntry[]> {
  const { data } = await supabase.from("working_hours").select("weekday,is_open,open_time,close_time");
  return (data ?? []) as WorkingHoursEntry[];
}

export interface CreateBookingConflict {
  bookingId: string;
  status: "confirmed" | "pending_conflict";
  conflict?: {
    clashes: OverlapCandidate[];
    suggestions: { startsAt: string; endsAt: string; labelKey: string }[];
  };
}

/** Create a booking. If it clashes, returns the clash details + suggestions WITHOUT saving. */
export async function createBookingAction(raw: unknown): Promise<ActionResult<CreateBookingConflict>> {
  try {
    const profile = await requireUser();
    const parsed = bookingInput.safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const input = parsed.data;
    if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
      return fail("validation", "End time must be after start time.");
    }
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    // 1) Conflict check (app layer — the DB trigger is the backstop)
    const windowFrom = new Date(new Date(input.startsAt).getTime() - 24 * 3600_000).toISOString();
    const windowTo = new Date(new Date(input.endsAt).getTime() + 24 * 3600_000).toISOString();
    const existing = input.roomId
      ? await loadRoomWindow(supabase, input.roomId, windowFrom, windowTo)
      : [];
    const clashes = findOverlaps(input.roomId ?? null, input.startsAt, input.endsAt, existing);

    if (clashes.length > 0) {
      const workingHours = await loadWorkingHours(supabase);
      const durationMin = Math.round(
        (new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) / 60000,
      );
      const { data: roomRow } = await supabase.from("business_settings").select("slot_increment_min,buffer_min").single();
      const suggestions = input.roomId
        ? suggestSlots({
            roomId: input.roomId,
            desiredStart: new Date(input.startsAt),
            durationMin,
            incrementMin: (roomRow?.slot_increment_min ?? 30) as 15 | 30 | 60,
            bufferMin: roomRow?.buffer_min ?? 0,
            daysAhead: 14,
            limit: 4,
            existing,
            workingHours,
            timeZone: "Africa/Casablanca",
          })
        : [];
      return { ok: true, data: { bookingId: "", status: "pending_conflict", conflict: { clashes, suggestions } } };
    }

    // 2) Clean slot — insert as confirmed
    const { data: inserted, error } = await supabase
      .from("bookings")
      .insert({
        type: input.type,
        title: input.title,
        category_id: input.categoryId,
        room_id: input.roomId ?? null,
        client_id: input.clientId ?? null,
        created_by: profile.id,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        status: "confirmed",
        price: input.price ?? null,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "P0001" || /room_conflict/.test(error.message)) {
        return fail("room_conflict", "That slot was just taken — refresh and pick another time.");
      }
      throw error;
    }
    await logAudit(supabase, {action: "booking.create", entityType: "booking", entityId: inserted.id, meta: { room_id: input.roomId ?? null, type: input.type }});
    await notifyBookingEvent(supabase, inserted.id, "created");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return { ok: true, data: { bookingId: inserted.id, status: "confirmed" } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Save the booking as PENDING and open a change request to the incumbent. */
export async function requestChangeAction(raw: unknown): Promise<ActionResult<{ requestId: string; bookingId: string }>> {
  try {
    const profile = await requireUser();
    const parsed = bookingInput
      .extend({
        conflictingBookingId: z.string().uuid(),
        message: z.string().max(1000).nullable().optional(),
        existingBookingId: z.string().uuid().optional(),
      })
      .safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const { conflictingBookingId, message, existingBookingId, ...input } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const { data: incumbent, error: incErr } = await supabase
      .from("bookings")
      .select("id,title,created_by,starts_at,ends_at,room_id,status")
      .eq("id", conflictingBookingId)
      .single();
    if (incErr || !incumbent) return fail("not_found", "The conflicting booking no longer exists.");

    // Save the requester's booking as pending_conflict — update in place when editing,
    // insert fresh when creating.
    let newBookingId = "";
    if (existingBookingId) {
      const { error: updErr } = await supabase
        .from("bookings")
        .update({
          title: input.title,
          type: input.type,
          category_id: input.categoryId,
          room_id: input.roomId ?? null,
          client_id: input.clientId ?? null,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          status: "pending_conflict",
          price: input.price ?? null,
          notes: input.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingBookingId);
      if (updErr) throw updErr;
      newBookingId = existingBookingId;
    } else {
      const { data: inserted, error: nbErr } = await supabase
        .from("bookings")
        .insert({
          type: input.type,
          title: input.title,
          category_id: input.categoryId,
          room_id: input.roomId ?? null,
          client_id: input.clientId ?? null,
          created_by: profile.id,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          status: "pending_conflict",
          price: input.price ?? null,
          notes: input.notes ?? null,
        })
        .select("id")
        .single();
      if (nbErr) throw nbErr;
      if (!inserted) return fail("unexpected", "The booking was created but its id could not be read back.");
      newBookingId = inserted.id;
    }

    // Suggestions FOR THE INCUMBENT (next free windows of the same room)
    const windowFrom = new Date(Date.now() - 3600_000).toISOString();
    const windowTo = new Date(Date.now() + 21 * 86400_000).toISOString();
    const existing = incumbent.room_id
      ? await loadRoomWindow(supabase, incumbent.room_id, windowFrom, windowTo)
      : [];
    const workingHours = await loadWorkingHours(supabase);
    const durationMin = Math.round(
      (new Date(incumbent.ends_at).getTime() - new Date(incumbent.starts_at).getTime()) / 60000,
    );
    const suggested = incumbent.room_id
      ? suggestSlots({
          roomId: incumbent.room_id,
          desiredStart: new Date(),
          durationMin,
          incrementMin: 30,
          bufferMin: 0,
          daysAhead: 14,
          limit: 4,
          existing,
          workingHours,
          timeZone: "Africa/Casablanca",
        }).map((s) => ({ starts_at: s.startsAt, ends_at: s.endsAt }))
      : [];

    const { data: request, error: crErr } = await supabase
      .from("change_requests")
      .insert({
        new_booking_id: newBookingId,
        conflicting_booking_id: incumbent.id,
        requested_by: profile.id,
        assigned_to: incumbent.created_by,
        message: message ?? null,
        suggested_slots: suggested,
        status: "pending",
      })
      .select("id")
      .single();
    if (crErr) throw crErr;

    await notifyUser(supabase, {userId: incumbent.created_by, type: "change_request_received", title: `${profile.full_name} asked to move "${incumbent.title}"`, body: message ?? "They need the slot for another booking.", link: `/requests/${request.id}`, entityId: request.id});
    await logAudit(supabase, {action: "change_request.create", entityType: "change_request", entityId: request.id, meta: { new_booking_id: newBookingId, conflicting_booking_id: incumbent.id, suggested_count: suggested.length }});
    await notifyChangeRequestEvent(supabase, request.id, "received");

    revalidatePath("/calendar");
    return { ok: true, data: { requestId: request.id, bookingId: newBookingId } };
  } catch (err) {
    return failUnexpected(err);
  }
}

const respondInput = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "decline"]),
  slot: z.object({ startsAt: isoDate, endsAt: isoDate }).optional(),
  message: z.string().max(1000).nullable().optional(),
});

/** Incumbent responds: approve (guided move) or decline. */
export async function respondToChangeRequestAction(raw: unknown): Promise<ActionResult<{ status: "approved" | "declined" }>> {
  try {
    const profile = await requireUser();
    const parsed = respondInput.safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { requestId, decision, slot, message } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const { data: req, error } = await supabase
      .from("change_requests")
      .select("id,status,new_booking_id,conflicting_booking_id,assigned_to,requested_by,suggested_slots")
      .eq("id", requestId)
      .single();
    if (error || !req) return fail("not_found", "Change request not found.");
    const isAssignee = req.assigned_to === profile.id;
    const isAdmin = profile.role === "admin";
    if (!isAssignee && !isAdmin) return fail("forbidden", "This request isn't addressed to you.");
    if (req.status !== "pending") return fail("state", "This request was already resolved.");

    if (decision === "approve") {
      const chosenSlot =
        slot ??
        (Array.isArray(req.suggested_slots) && req.suggested_slots[0]
          ? { startsAt: req.suggested_slots[0].starts_at, endsAt: req.suggested_slots[0].ends_at }
          : undefined);
      if (!chosenSlot) return fail("validation", "Pick a slot to move your booking to.");

      // Move the incumbent booking
      const { error: moveErr } = await supabase
        .from("bookings")
        .update({ starts_at: chosenSlot.startsAt, ends_at: chosenSlot.endsAt })
        .eq("id", req.conflicting_booking_id);
      if (moveErr) {
        if (moveErr.code === "P0001" || /room_conflict/.test(moveErr.message)) {
          return fail("room_conflict", "That new slot is taken too — pick another.");
        }
        throw moveErr;
      }
      // Confirm the requester's held booking
      await supabase.from("bookings").update({ status: "confirmed" }).eq("id", req.new_booking_id);
      await supabase
        .from("change_requests")
        .update({ status: "approved", response_message: message ?? null, responded_at: new Date().toISOString(), resolved_booking_id: req.conflicting_booking_id })
        .eq("id", req.id);
      await notifyUser(supabase, {userId: req.requested_by, type: "change_request_approved", title: "Slot secured", body: message ?? "The other booking was moved — yours is confirmed.", link: `/requests/${req.id}`, entityId: req.id});
      await logAudit(supabase, {action: "change_request.approve", entityType: "change_request", entityId: req.id, meta: { moved_to: chosenSlot }});
      await notifyChangeRequestEvent(supabase, req.id, "approved");
    } else {
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", req.new_booking_id);
      await supabase
        .from("change_requests")
        .update({ status: "declined", response_message: message ?? null, responded_at: new Date().toISOString() })
        .eq("id", req.id);
      await notifyUser(supabase, {userId: req.requested_by, type: "change_request_declined", title: "Change request declined", body: message ?? "They can't move the booking. See alternative slots on the request.", link: `/requests/${req.id}`, entityId: req.id});
      await logAudit(supabase, {action: "change_request.decline", entityType: "change_request", entityId: req.id});
      await notifyChangeRequestEvent(supabase, req.id, "declined");
    }
    revalidatePath("/calendar");
    return { ok: true, data: { status: decision === "approve" ? "approved" : "declined" } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Requester cancels their own held booking + change request. */
export async function cancelChangeRequestAction(raw: unknown): Promise<ActionResult<{ status: "cancelled" }>> {
  try {
    const profile = await requireUser();
    const parsed = z.object({ requestId: z.string().uuid() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: req } = await supabase
      .from("change_requests").select("id,status,requested_by,new_booking_id").eq("id", parsed.data.requestId).single();
    if (!req) return fail("not_found", "Request not found.");
    if (req.requested_by !== profile.id && profile.role !== "admin") return fail("forbidden", "Only the requester can cancel.");
    if (req.status !== "pending") return fail("state", "Already resolved.");
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", req.new_booking_id);
    await supabase.from("change_requests").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("id", req.id);
    await logAudit(supabase, {action: "change_request.cancel", entityType: "change_request", entityId: req.id});
    revalidatePath("/calendar");
    return { ok: true, data: { status: "cancelled" } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Remove a booking entirely (creator or admin). Hard delete — audit log keeps the trail. */
export async function cancelBookingAction(raw: unknown): Promise<ActionResult<{ status: "cancelled" }>> {
  try {
    const profile = await requireUser();
    const parsed = z.object({ bookingId: z.string().uuid(), reason: z.string().max(500).nullable().optional() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: existing } = await supabase
      .from("bookings")
      .select("id,created_by,title,starts_at,ends_at,room_id,status")
      .eq("id", parsed.data.bookingId)
      .single();
    if (!existing) return fail("not_found", "Booking not found.");
    if (existing.created_by !== profile.id && profile.role !== "admin") return fail("forbidden", "Only the creator or an admin can remove a booking.");

    await notifyBookingEvent(supabase, parsed.data.bookingId, "cancelled");

    // Audit FIRST — the row is about to vanish; the trail must survive.
    await logAudit(supabase, {action: "booking.delete", entityType: "booking", entityId: parsed.data.bookingId, meta: { title: existing.title, starts_at: existing.starts_at, ends_at: existing.ends_at, room_id: existing.room_id, status: existing.status, reason: parsed.data.reason ?? null, }});

    // Hard delete — cascades clear formations/participants/change-requests.
    const { error } = await supabase.from("bookings").delete().eq("id", parsed.data.bookingId);
    if (error) throw error;
    revalidatePath("/calendar");
    revalidatePath("/reports");
    return { ok: true, data: { status: "cancelled" } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** List bookings overlapping [from,to), with optional filters — live data source for the calendar. */
export async function listBookingsAction(filters: {
  from: string;
  to: string;
  roomId?: string | null;
  location?: string | null;
  categoryId?: string | null;
  query?: string | null;
}): Promise<ActionResult<{ bookings: BookingRow[]; total: number }>> {
  try {
    await requireUser();
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    let q = supabase
      .from("bookings")
      .select("id,type,title,category_id,room_id,client_id,created_by,starts_at,ends_at,status,price,notes")
      .lt("starts_at", filters.to)
      .gt("ends_at", filters.from)
      .order("starts_at", { ascending: true })
      .limit(300);
    if (filters.roomId) q = q.eq("room_id", filters.roomId);
    if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
    if (filters.query) q = q.ilike("title", `%${filters.query}%`);
    const { data, error } = await q;
    if (error) throw error;
    let rows = (data ?? []) as BookingRow[];
    if (filters.location) {
      const { data: rooms } = await supabase.from("rooms").select("id").eq("location", filters.location);
      const ids = new Set((rooms ?? []).map((r) => r.id));
      rows = rows.filter((b) => b.room_id == null || ids.has(b.room_id));
    }
    return { ok: true, data: { bookings: rows, total: rows.length } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Mark notifications as read. */
export async function markNotificationsReadAction(ids: string[]): Promise<ActionResult<{ updated: number }>> {
  try {
    const profile = await requireUser();
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .in("id", ids)
      .is("read_at", null);
    if (error) throw error;
    revalidatePath("/notifications");
    return { ok: true, data: { updated: ids.length } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/* ------------------------------------------------------------------ */
/* Edit / pause / postpone (context menu + drawer edit mode)          */
/* ------------------------------------------------------------------ */

const updateInput = bookingInput.partial().extend({
  bookingId: z.string().uuid(),
});

/** Partial update of a booking. If the new time/room clashes, returns the conflict payload WITHOUT saving. */
export async function updateBookingAction(raw: unknown): Promise<ActionResult<{ bookingId: string; status?: BookingStatus } | { conflict: { clashes: OverlapCandidate[]; suggestions: { startsAt: string; endsAt: string; labelKey: string }[] } }>> {
  try {
    const profile = await requireUser();
    const parsed = updateInput.safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const { bookingId, type, categoryId, roomId, clientId, title, startsAt, endsAt, price, notes } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const { data: existing, error: loadErr } = await supabase
      .from("bookings")
      .select("id,created_by,starts_at,ends_at,room_id,status")
      .eq("id", bookingId)
      .single();
    if (loadErr || !existing) return fail("not_found", "Booking not found.");
    const isCreator = existing.created_by === profile.id;
    const isAdmin = profile.role === "admin";
    if (!isCreator && !isAdmin) return fail("forbidden", "Only the creator or an admin can edit this booking.");

    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (type !== undefined) patch.type = type;
    if (categoryId !== undefined) patch.category_id = categoryId;
    if (roomId !== undefined) patch.room_id = roomId;
    if (clientId !== undefined) patch.client_id = clientId;
    if (price !== undefined) patch.price = price;
    if (notes !== undefined) patch.notes = notes;

    const timeChanged = startsAt !== undefined || endsAt !== undefined || roomId !== undefined;
    const newStart = startsAt ?? existing.starts_at;
    const newEnd = endsAt ?? existing.ends_at;
    const newRoom = roomId !== undefined ? roomId : existing.room_id;
    if (new Date(newEnd).getTime() <= new Date(newStart).getTime()) {
      return fail("validation", "End time must be after start time.");
    }
    if (startsAt !== undefined) patch.starts_at = startsAt;
    if (endsAt !== undefined) patch.ends_at = endsAt;

    if (timeChanged) {
      const windowFrom = new Date(new Date(newStart).getTime() - 86400000).toISOString();
      const windowTo = new Date(new Date(newEnd).getTime() + 86400000).toISOString();
      const occupied = newRoom ? await loadRoomWindow(supabase, newRoom, windowFrom, windowTo) : [];
      const clashes = findOverlaps(newRoom, newStart, newEnd, occupied, bookingId);
      if (clashes.length > 0) {
        const workingHours = await loadWorkingHours(supabase);
        const durationMin = Math.round((new Date(newEnd).getTime() - new Date(newStart).getTime()) / 60000);
        const { data: roomRow } = await supabase.from("business_settings").select("slot_increment_min,buffer_min").single();
        const suggestions = newRoom
          ? suggestSlots({
              roomId: newRoom,
              desiredStart: new Date(newStart),
              durationMin,
              incrementMin: (roomRow?.slot_increment_min ?? 30) as 15 | 30 | 60,
              bufferMin: roomRow?.buffer_min ?? 0,
              daysAhead: 14,
              limit: 4,
              existing: occupied,
              workingHours,
              timeZone: "Africa/Casablanca",
            })
          : [];
        return { ok: true, data: { conflict: { clashes, suggestions } } };
      }
    }

    const { error } = await supabase.from("bookings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", bookingId);
    if (error) {
      if (error.code === "P0001" || /room_conflict/.test(error.message)) {
        return fail("room_conflict", "That slot was just taken — refresh and pick another time.");
      }
      throw error;
    }
    await logAudit(supabase, {action: "booking.update", entityType: "booking", entityId: bookingId, meta: patch});
    await notifyBookingEvent(supabase, bookingId, "updated");
    revalidatePath("/calendar");
    return { ok: true, data: { bookingId } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Toggle the paused state of a booking (confirmed ↔ paused). */
export async function pauseBookingAction(raw: unknown): Promise<ActionResult<{ status: "confirmed" | "paused" }>> {
  try {
    const profile = await requireUser();
    const parsed = z.object({ bookingId: z.string().uuid(), paused: z.boolean() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { bookingId, paused } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const { data: existing } = await supabase.from("bookings").select("id,created_by,status,title").eq("id", bookingId).single();
    if (!existing) return fail("not_found", "Booking not found.");
    const isCreator = existing.created_by === profile.id;
    const isAdmin = profile.role === "admin";
    if (!isCreator && !isAdmin) return fail("forbidden", "Only the creator or an admin can change this booking.");
    if (paused && existing.status !== "confirmed") return fail("state", "Only a confirmed booking can be paused.");
    if (!paused && existing.status !== "paused") return fail("state", "This booking is not paused.");

    const { error } = await supabase
      .from("bookings")
      .update({ status: paused ? "paused" : "confirmed", updated_at: new Date().toISOString() })
      .eq("id", bookingId);
    if (error) throw error;
    await logAudit(supabase, {action: paused ? "booking.pause" : "booking.resume", entityType: "booking", entityId: bookingId, meta: { title: existing.title }});
    revalidatePath("/calendar");
    return { ok: true, data: { status: paused ? "paused" : "confirmed" } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Postpone a booking to a new slot — conflict-checked like a fresh booking. */
export async function postponeBookingAction(raw: unknown): Promise<ActionResult<{ bookingId: string } | { conflict: { clashes: OverlapCandidate[]; suggestions: { startsAt: string; endsAt: string; labelKey: string }[] } }>> {
  try {
    const profile = await requireUser();
    const parsed = z.object({
      bookingId: z.string().uuid(),
      startsAt: isoDate,
      endsAt: isoDate,
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { bookingId, startsAt, endsAt } = parsed.data;
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      return fail("validation", "End time must be after start time.");
    }
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const { data: existing } = await supabase.from("bookings").select("id,created_by,room_id,status,title").eq("id", bookingId).single();
    if (!existing) return fail("not_found", "Booking not found.");
    const isCreator = existing.created_by === profile.id;
    const isAdmin = profile.role === "admin";
    if (!isCreator && !isAdmin) return fail("forbidden", "Only the creator or an admin can postpone this booking.");
    if (existing.status === "cancelled") return fail("state", "A cancelled booking cannot be postponed.");

    if (existing.room_id) {
      const windowFrom = new Date(new Date(startsAt).getTime() - 86400000).toISOString();
      const windowTo = new Date(new Date(endsAt).getTime() + 86400000).toISOString();
      const occupied = await loadRoomWindow(supabase, existing.room_id, windowFrom, windowTo);
      const clashes = findOverlaps(existing.room_id, startsAt, endsAt, occupied, bookingId);
      if (clashes.length > 0) {
        const workingHours = await loadWorkingHours(supabase);
        const durationMin = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
        const { data: roomRow } = await supabase.from("business_settings").select("slot_increment_min,buffer_min").single();
        const suggestions = suggestSlots({
          roomId: existing.room_id,
          desiredStart: new Date(startsAt),
          durationMin,
          incrementMin: (roomRow?.slot_increment_min ?? 30) as 15 | 30 | 60,
          bufferMin: roomRow?.buffer_min ?? 0,
          daysAhead: 14,
          limit: 4,
          existing: occupied,
          workingHours,
          timeZone: "Africa/Casablanca",
        });
        return { ok: true, data: { conflict: { clashes, suggestions } } };
      }
    }

    const { error } = await supabase
      .from("bookings")
      .update({ starts_at: startsAt, ends_at: endsAt, updated_at: new Date().toISOString() })
      .eq("id", bookingId);
    if (error) {
      if (error.code === "P0001" || /room_conflict/.test(error.message)) {
        return fail("room_conflict", "That slot was just taken — pick another.");
      }
      throw error;
    }
    await logAudit(supabase, {action: "booking.postpone", entityType: "booking", entityId: bookingId, meta: { starts_at: startsAt, ends_at: endsAt }});
    await notifyBookingEvent(supabase, bookingId, "updated");
    revalidatePath("/calendar");
    return { ok: true, data: { bookingId } };
  } catch (err) {
    return failUnexpected(err);
  }
}
