"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireAdmin } from "@/lib/auth";
import type { ActionResult, ClientRow } from "@/lib/types/db";
import { logAudit } from "@/lib/audit";

function notConfigured<T>(): ActionResult<T> {
  return { ok: false, error: { code: "not_configured", message: "Supabase isn't configured: set .env." } };
}
function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}
function failUnexpected(err: unknown): ActionResult<never> {
  console.error("[clients] unexpected error", err);
  return { ok: false, error: { code: "unexpected", message: "Something went wrong. Please try again." } };
}

const clientInput = z.object({
  type: z.enum(["person", "company"]).default("person"),
  fullName: z.string().trim().min(2).max(160),
  company: z.string().trim().max(160).nullable().optional(),
  email: z.email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: z.string().max(40).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  source: z.string().max(60).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  status: z.enum(["lead", "active", "inactive"]).default("active"),
});

export interface DuplicateClient { existing: Pick<ClientRow, "id" | "full_name" | "company" | "email" | "phone"> }

/** Create a client. Returns { duplicate } with the existing row when email/phone already exists. */
export async function createClientAction(raw: unknown): Promise<ActionResult<{ clientId: string } | { duplicate: DuplicateClient }>> {
  try {
    const profile = await requireUser();
    const parsed = clientInput.safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const input = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    // Duplicate detection on email OR phone
    const filters: string[] = [];
    if (input.email) filters.push(`email.eq.${input.email}`);
    if (input.phone) filters.push(`phone.eq.${input.phone}`);
    if (filters.length > 0) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id,full_name,company,email,phone")
        .or(filters.join(","))
        .limit(1);
      if (existing?.[0]) {
        return { ok: true, data: { duplicate: { existing: existing[0] } } };
      }
    }

    const { data: inserted, error } = await supabase
      .from("clients")
      .insert({
        type: input.type,
        full_name: input.fullName,
        company: input.company ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        tags: input.tags ?? [],
        source: input.source ?? null,
        notes: input.notes ?? null,
        status: input.status,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    await logAudit(supabase, {action: "client.create", entityType: "client", entityId: inserted.id});
    revalidatePath("/clients");
    return { ok: true, data: { clientId: inserted.id } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Append a timestamped note to a client record. */
export async function addClientNoteAction(raw: unknown): Promise<ActionResult<{ notes: string }>> {
  try {
    const profile = await requireUser();
    const parsed = z.object({ clientId: z.string().uuid(), note: z.string().trim().min(1).max(2000) }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Write something first");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: existing } = await supabase.from("clients").select("notes").eq("id", parsed.data.clientId).single();
    if (!existing) return fail("not_found", "Client not found.");
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const prefix = existing.notes?.trim() ? `${existing.notes.trim()}\n\n` : "";
    const notes = `${prefix}[${stamp} · ${profile.full_name}] ${parsed.data.note}`;
    const { error } = await supabase.from("clients").update({ notes }).eq("id", parsed.data.clientId);
    if (error) throw error;
    revalidatePath(`/clients/${parsed.data.clientId}`);
    return { ok: true, data: { notes } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** GDPR anonymize: admin only. Keeps bookings aggregates, strips PII. */
export async function anonymizeClientAction(raw: unknown): Promise<ActionResult<{ anonymized: true }>> {
  try {
    await requireAdmin();
    const parsed = z.object({ clientId: z.string().uuid(), confirmName: z.string().min(1) }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Confirmation required");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: existing } = await supabase.from("clients").select("id,full_name").eq("id", parsed.data.clientId).single();
    if (!existing) return fail("not_found", "Client not found.");
    if (parsed.data.confirmName.trim() !== existing.full_name) {
      return fail("confirm", "Type the client's exact name to confirm anonymization.");
    }
    const { error } = await supabase
      .from("clients")
      .update({
        full_name: `Client #${existing.id.slice(0, 8).toUpperCase()}`,
        company: null, email: null, phone: null, address: null, city: null,
        tags: [], notes: null, anonymized_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
    await logAudit(supabase, {action: "client.anonymize", entityType: "client", entityId: existing.id});
    revalidatePath("/clients");
    return { ok: true, data: { anonymized: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}
