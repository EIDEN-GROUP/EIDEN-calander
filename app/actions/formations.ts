"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types/db";

function notConfigured<T>(): ActionResult<T> {
  return { ok: false, error: { code: "not_configured", message: "Supabase isn't configured — set .env." } };
}
function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}
function failUnexpected(err: unknown): ActionResult<never> {
  console.error("[formations] unexpected error", err);
  return { ok: false, error: { code: "unexpected", message: "Something went wrong. Please try again." } };
}
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T/);

const formationInput = z.object({
  title: z.string().trim().min(2).max(200),
  categoryId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  startsAt: isoDate,
  endsAt: isoDate,
  capacity: z.number().int().min(1).max(500),
  priceLabel: z.number().min(0).max(1_000_000).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

/** Create a formation (booking of type formation + formation row). */
export async function createFormationAction(raw: unknown): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const profile = await requireUser();
    const parsed = formationInput.safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const input = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .insert({
        type: "formation",
        title: input.title,
        category_id: input.categoryId,
        room_id: input.roomId ?? null,
        created_by: profile.id,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        status: "confirmed",
        price: input.priceLabel ?? null,
      })
      .select("id")
      .single();
    if (bErr) throw bErr;

    const { error: fErr } = await supabase.from("formations").insert({
      booking_id: booking.id,
      capacity: input.capacity,
      description: input.description ?? null,
      price_label: input.priceLabel ?? null,
      status: "open",
    });
    if (fErr) throw fErr;

    await supabase.from("audit_log").insert({
      actor_id: profile.id, action: "formation.create", entity_type: "formation", entity_id: booking.id,
    });
    revalidatePath("/formations");
    revalidatePath("/calendar");
    return { ok: true, data: { bookingId: booking.id } };
  } catch (err) {
    return failUnexpected(err);
  }
}

const participantInput = z.object({
  bookingId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(120).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
});

/** Enroll a participant — waitlist automatically when at capacity. */
export async function enrollParticipantAction(raw: unknown): Promise<ActionResult<{ participantId: string; waitlisted: boolean }>> {
  try {
    await requireUser();
    const parsed = participantInput.safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const input = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const { data: formation, error: fErr } = await supabase
      .from("formations").select("booking_id,capacity,status").eq("booking_id", input.bookingId).single();
    if (fErr || !formation) return fail("not_found", "Formation not found.");
    if (formation.status === "cancelled") return fail("state", "This formation was cancelled.");

    const { count } = await supabase
      .from("formation_participants")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", input.bookingId)
      .in("status", ["enrolled", "confirmed"])
      .eq("waitlist", false);

    const waitlisted = (count ?? 0) >= formation.capacity;

    const { data: inserted, error } = await supabase
      .from("formation_participants")
      .insert({
        booking_id: input.bookingId,
        full_name: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        client_id: input.clientId ?? null,
        status: "enrolled",
        waitlist: waitlisted,
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidatePath(`/formations/${input.bookingId}`);
    return { ok: true, data: { participantId: inserted.id, waitlisted } };
  } catch (err) {
    return failUnexpected(err);
  }
}

const attendanceInput = z.object({
  participantId: z.string().uuid(),
  status: z.enum(["enrolled", "confirmed", "attended", "no_show", "cancelled"]),
});

/** Set attendance status for a participant. */
export async function markAttendanceAction(raw: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    await requireUser();
    const parsed = attendanceInput.safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { participantId, status } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase
      .from("formation_participants")
      .update({ status, checked_in_at: status === "attended" ? new Date().toISOString() : null })
      .eq("id", participantId);
    if (error) throw error;
    revalidatePath("/formations");
    return { ok: true, data: { status } };
  } catch (err) {
    return failUnexpected(err);
  }
}

const importInput = z.object({
  bookingId: z.string().uuid(),
  rows: z.array(z.object({
    full_name: z.string().trim().min(1).max(120),
    email: z.string().trim().max(200).nullish(),
    phone: z.string().trim().max(40).nullish(),
    company: z.string().trim().max(120).nullish(),
  })).max(500),
});

/** Bulk import participants from a CSV dry-run — skips duplicate emails per formation. */
export async function importParticipantsAction(raw: unknown): Promise<ActionResult<{ enrolled: number; skipped: number }>> {
  try {
    await requireUser();
    const parsed = importInput.safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid CSV rows");
    const { bookingId, rows } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const { data: existing } = await supabase
      .from("formation_participants").select("email").eq("booking_id", bookingId);
    const seen = new Set((existing ?? []).map((r) => (r.email ?? "").toLowerCase()).filter(Boolean));

    let skipped = 0;
    const toInsert: typeof rows = [];
    for (const row of rows) {
      const email = row.email?.toLowerCase().trim() || null;
      if (email && seen.has(email)) { skipped++; continue; }
      if (email) seen.add(email);
      toInsert.push(row);
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from("formation_participants").insert(
        toInsert.map((r) => ({
          booking_id: bookingId,
          full_name: r.full_name,
          email: r.email?.trim() || null,
          phone: r.phone?.trim() || null,
          company: r.company?.trim() || null,
          status: "enrolled",
          waitlist: false,
        })),
      );
      if (error) throw error;
    }
    revalidatePath(`/formations/${bookingId}`);
    return { ok: true, data: { enrolled: toInsert.length, skipped } };
  } catch (err) {
    return failUnexpected(err);
  }
}
