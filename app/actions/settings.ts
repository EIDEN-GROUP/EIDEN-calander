"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/types/db";
import { logAudit } from "@/lib/audit";

function notConfigured<T>(): ActionResult<T> {
  return { ok: false, error: { code: "not_configured", message: "Supabase isn't configured — set .env." } };
}
function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}
function failUnexpected(err: unknown): ActionResult<never> {
  console.error("[settings] unexpected error", err);
  return { ok: false, error: { code: "unexpected", message: "Something went wrong. Please try again." } };
}

/* ---------------- Business profile ---------------- */
export async function updateBusinessProfileAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const admin = await requireAdmin();
    const parsed = z.object({
      businessName: z.string().trim().min(1).max(160),
      legalName: z.string().max(160).nullable().optional(),
      email: z.email().max(200),
      phone: z.string().max(40).nullable().optional(),
      address: z.string().max(240).nullable().optional(),
      city: z.string().max(80).nullable().optional(),
      country: z.string().max(80).nullable().optional(),
      timezone: z.string().max(64),
      currency: z.string().length(3),
      publicUrl: z.string().max(200).nullable().optional(),
      slotIncrementMin: z.union([z.literal(15), z.literal(30), z.literal(60)]),
      bufferMin: z.number().int().min(0).max(120),
      minNoticeHours: z.number().int().min(0).max(720),
      defaultLocale: z.enum(["en", "fr"]),
      hourCycle: z.enum(["24", "12"]).optional(),
      dateFormat: z.enum(["eu", "us"]).optional(),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const input = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const update: Record<string, unknown> = {
        business_name: input.businessName,
        legal_name: input.legalName ?? null,
        email: input.email,
        phone: input.phone ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        timezone: input.timezone,
        currency: input.currency,
        public_url: input.publicUrl ?? null,
        slot_increment_min: input.slotIncrementMin,
        buffer_min: input.bufferMin,
        min_notice_hours: input.minNoticeHours,
        default_locale: input.defaultLocale,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
    };
    if (input.hourCycle !== undefined) update.hour_cycle = input.hourCycle;
    if (input.dateFormat !== undefined) update.date_format = input.dateFormat;
    const { error } = await supabase
      .from("business_settings")
      .update(update)
      .eq("id", true);
    if (error) throw error;
    await logAudit(supabase, {action: "settings.business", entityType: "settings", entityId: "business_settings"});
    revalidatePath("/settings/general");
    revalidatePath("/settings/localization");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

const PREF_KEYS = [
  "booking_created",
  "booking_updated",
  "booking_cancelled",
  "formation_reminder",
  "change_request_received",
  "change_request_approved",
  "change_request_declined",
  "change_request_expired",
  "welcome",
] as const;
export type NotificationPrefKey = (typeof PREF_KEYS)[number];

/** Persist the business-wide transactional email switches. Admin only. */
export async function updateNotificationPrefsAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const admin = await requireAdmin();
    const shape: Record<string, z.ZodOptional<z.ZodBoolean>> = {};
    for (const key of PREF_KEYS) shape[key] = z.boolean().optional();
    const parsed = z.object(shape).strict().safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid preferences payload.");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    // Merge onto the current jsonb so unknown keys (added later) survive.
    const { data: current, error: readErr } = await supabase
      .from("business_settings")
      .select("notification_prefs")
      .eq("id", true)
      .single();
    if (readErr) throw readErr;
    const merged = { ...((current?.notification_prefs ?? {}) as Record<string, unknown>), ...parsed.data };
    const { error } = await supabase
      .from("business_settings")
      .update({ notification_prefs: merged, updated_by: admin.id, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw error;
    await logAudit(supabase, {action: "settings.notification_prefs", entityType: "settings", entityId: "business_settings", meta: parsed.data});
    revalidatePath("/settings/notifications");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Persist localization defaults (locale, hour cycle, date format). Admin only. */
export async function updateLocalizationAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const admin = await requireAdmin();
    const parsed = z.object({
      defaultLocale: z.enum(["en", "fr"]),
      hourCycle: z.enum(["24", "12"]),
      dateFormat: z.enum(["eu", "us"]),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid localization settings.");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase
      .from("business_settings")
      .update({
        default_locale: parsed.data.defaultLocale,
        hour_cycle: parsed.data.hourCycle,
        date_format: parsed.data.dateFormat,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw error;
    await logAudit(supabase, {action: "settings.localization", entityType: "settings", entityId: "business_settings", meta: parsed.data});
    revalidatePath("/settings/localization");
    revalidatePath("/settings/general");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Point business_settings.logo_url at an already-uploaded brand-assets file. */
export async function updateBusinessLogoAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const admin = await requireAdmin();
    const parsed = z.object({
      logoUrl: z
        .string()
        .url()
        .max(600)
        .refine((u) => u.includes("/storage/v1/object/public/brand-assets/"), "Logo must be an uploaded brand-assets file.")
        .nullable(), // null clears the logo
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Logo URL must point at the uploaded file.");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase
      .from("business_settings")
      .update({ logo_url: parsed.data.logoUrl, updated_by: admin.id, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw error;
    await logAudit(supabase, {action: "settings.logo", entityType: "settings", entityId: "business_settings"});
    revalidatePath("/settings/general");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/* ---------------- Working hours (7 rows) + availability prefs ---------------- */
const workingHoursInput = z.object({
  weekdays: z.array(z.object({
    weekday: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    is_open: z.boolean(),
    open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  })).length(7),
  slotIncrementMin: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
  bufferMin: z.number().int().min(0).max(120).optional(),
  minNoticeHours: z.number().int().min(0).max(720).optional(),
});

export async function updateWorkingHoursAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const admin = await requireAdmin();
    const parsed = workingHoursInput.safeParse(raw);
    if (!parsed.success) return fail("validation", "Provide all 7 weekdays");
    const { weekdays, slotIncrementMin, bufferMin, minNoticeHours } = parsed.data;
    for (const row of weekdays) {
      if (row.is_open && row.open_time >= row.close_time) {
        return fail("validation", `${row.weekday}: open time must be before close time`);
      }
    }
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("working_hours").upsert(weekdays, { onConflict: "weekday" });
    if (error) throw error;
    if (slotIncrementMin !== undefined || bufferMin !== undefined || minNoticeHours !== undefined) {
      const patch: Record<string, number> = {};
      if (slotIncrementMin !== undefined) patch.slot_increment_min = slotIncrementMin;
      if (bufferMin !== undefined) patch.buffer_min = bufferMin;
      if (minNoticeHours !== undefined) patch.min_notice_hours = minNoticeHours;
      if (Object.keys(patch).length > 0) {
        const { error: sErr } = await supabase.from("business_settings").update({ ...patch, updated_by: admin.id, updated_at: new Date().toISOString() }).eq("id", true);
        if (sErr) throw sErr;
      }
    }
    await logAudit(supabase, {action: "settings.working_hours", entityType: "settings", entityId: "working_hours", meta: { slotIncrementMin, bufferMin, minNoticeHours }});
    revalidatePath("/settings/working-hours");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/* ---------------- Rooms ---------------- */
export async function createRoomAction(raw: unknown): Promise<ActionResult<{ roomId: string }>> {
  try {
    await requireAdmin();
    const parsed = z.object({
      name: z.string().trim().min(2).max(120),
      location: z.string().trim().min(2).max(80),
      capacity: z.number().int().min(1).max(1000),
      hourlyRate: z.number().min(0).max(100_000),
      amenities: z.array(z.string().max(40)).max(20).optional(),
      notes: z.string().max(500).nullable().optional(),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const input = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: inserted, error } = await supabase
      .from("rooms")
      .insert({ name: input.name, location: input.location, capacity: input.capacity, hourly_rate: input.hourlyRate, amenities: input.amenities ?? [], notes: input.notes ?? null })
      .select("id")
      .single();
    if (error) throw error;
    await logAudit(supabase, {action: "room.create", entityType: "room", entityId: inserted.id});
    revalidatePath("/settings/rooms");
    return { ok: true, data: { roomId: inserted.id } };
  } catch (err) {
    return failUnexpected(err);
  }
}

export async function toggleRoomActiveAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireAdmin();
    const parsed = z.object({ roomId: z.string().uuid(), isActive: z.boolean() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("rooms").update({ is_active: parsed.data.isActive }).eq("id", parsed.data.roomId);
    if (error) throw error;
    await logAudit(supabase, {action: "room.toggle", entityType: "room", entityId: parsed.data.roomId, meta: { is_active: parsed.data.isActive }});
    revalidatePath("/settings/rooms");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/* ---------------- Categories ---------------- */
const TINTS = ["blue", "green", "purple", "amber", "teal", "rose"] as const;

export async function createCategoryAction(raw: unknown): Promise<ActionResult<{ categoryId: string }>> {
  try {
    await requireAdmin();
    const parsed = z.object({
      nameEn: z.string().trim().min(2).max(80),
      nameFr: z.string().trim().max(80).nullable().optional(),
      type: z.enum(["standard", "formation"]).default("standard"),
      color: z.enum(TINTS),
      icon: z.string().max(60).default("calendar"),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const input = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: inserted, error } = await supabase
      .from("categories")
      .insert({ name_en: input.nameEn, name_fr: input.nameFr ?? null, type: input.type, color: input.color, icon: input.icon, is_system: false, sort: 99 })
      .select("id")
      .single();
    if (error) throw error;
    await logAudit(supabase, {action: "category.create", entityType: "category", entityId: inserted.id});
    revalidatePath("/settings/categories");
    return { ok: true, data: { categoryId: inserted.id } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/* ---------------- Team users (service-role for auth.admin) ---------------- */
export async function createTeamUserAction(raw: unknown): Promise<ActionResult<{ userId: string; tempPassword: string }>> {
  try {
    await requireAdmin();
    const parsed = z.object({
      fullName: z.string().trim().min(2).max(120),
      email: z.email().max(200),
      role: z.enum(["admin", "staff"]),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const { fullName, email, role } = parsed.data;
    const service = createServiceClient(); // throws outside configured env — caught below
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
    const tempPassword = Array.from(crypto.getRandomValues(new Uint32Array(14)))
      .map((n) => alphabet[n % alphabet.length]).join("");

    const { data: created, error } = await service.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error) {
      if (/already|exists|registered/i.test(error.message)) return fail("duplicate", "An account with this email already exists.");
      throw error;
    }
    const userId = created.user?.id;
    if (!userId) return fail("unexpected", "User creation returned no id.");

    // New staff start on the business default locale (welcome email + profile).
    const authedClient = await createClient();
    const { data: biz } = authedClient
      ? await authedClient.from("business_settings").select("default_locale").eq("id", true).maybeSingle()
      : { data: null };
    const defaultLocale = biz?.default_locale === "fr" ? "fr" : "en";

    const { error: profileErr } = await service.from("profiles").upsert({
      id: userId, email, full_name: fullName, role, is_active: true, must_change_password: true, locale: defaultLocale,
    });
    if (profileErr) throw profileErr;

    const supabase = authedClient ?? (await createClient());
    await logAudit(supabase, {action: "user.create", entityType: "user", entityId: userId, meta: { email, role }});
    // Best-effort welcome email with the one-time credentials (bilingual EN).
    try {
      const { sendMail } = await import("@/lib/email/send");
      const { welcomeTempPassword } = await import("@/lib/email/templates");
      const { isTransactionalEnabled } = await import("@/lib/email/notify");
      if (!supabase || !(await isTransactionalEnabled(supabase, "welcome"))) {
        console.log("[settings] welcome email — disabled in Settings → Notifications, skipping");
      } else {
        const tpl = welcomeTempPassword({ name: fullName, email, tempPassword, loginUrl: "https://calendar.eiden-group.com/login", locale: defaultLocale });
        await sendMail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      }
    } catch (e) {
      console.error("[settings] welcome email failed (account still created)", e);
    }
    revalidatePath("/settings/team");
    return { ok: true, data: { userId, tempPassword } };
  } catch (err) {
    return failUnexpected(err);
  }
}

export async function setTeamUserActiveAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const admin = await requireAdmin();
    const parsed = z.object({ userId: z.string().uuid(), isActive: z.boolean() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { userId, isActive } = parsed.data;
    if (userId === admin.id && !isActive) return fail("validation", "You cannot deactivate your own account.");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    // Last-admin guard
    if (!isActive) {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
      const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
      if (target?.role === "admin" && (count ?? 0) <= 1) {
        return fail("validation", "You cannot deactivate the last active admin.");
      }
    }
    const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
    if (error) throw error;
    try {
      const service = createServiceClient();
      await service.auth.admin.updateUserById(userId, isActive ? { ban_duration: "none" } : { ban_duration: "876600h" });
    } catch (e) {
      console.error("[settings] auth ban toggle failed", e);
    }
    await logAudit(supabase, {action: isActive ? "user.reactivate" : "user.deactivate", entityType: "user", entityId: userId});
    revalidatePath("/settings/team");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/* ---------------- Mail: SMTP/IMAP connection test (no secrets to client) ---------------- */
export async function testMailConnectionAction(raw: unknown): Promise<ActionResult<{ protocol: "smtp" | "imap"; ok: boolean; latencyMs?: number; error?: string }>> {
  try {
    await requireAdmin();
    const parsed = z.object({ protocol: z.enum(["smtp", "imap"]) }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid protocol");
    const started = Date.now();

    if (parsed.data.protocol === "smtp") {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
        return { ok: true, data: { protocol: "smtp", ok: false, error: "SMTP is not configured in this environment (SMTP_HOST/USER/PASSWORD)." } };
      }
      const port = Number(SMTP_PORT ?? 587);
      try {
        const transport = nodemailer.createTransport({
          host: SMTP_HOST, port, secure: port === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
          connectionTimeout: 8000, socketTimeout: 8000,
        });
        await transport.verify();
        transport.close();
        return { ok: true, data: { protocol: "smtp", ok: true, latencyMs: Date.now() - started } };
      } catch (e) {
        return { ok: true, data: { protocol: "smtp", ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "SMTP verify failed" } };
      }
    }

    // IMAP — light probe via imapflow without touching mailbox data
    const { IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD } = process.env;
    if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) {
      return { ok: true, data: { protocol: "imap", ok: false, error: "IMAP is not configured in this environment (IMAP_HOST/USER/PASSWORD)." } };
    }
    try {
      const { ImapFlow } = await import("imapflow");
      const client = new ImapFlow({
        host: IMAP_HOST, port: Number(IMAP_PORT ?? 993), secure: true,
        auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
        logger: false,
      });
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("IMAP connect timeout (8s)")), 8000));
      await Promise.race([client.connect(), timeout]);
      await client.logout();
      return { ok: true, data: { protocol: "imap", ok: true, latencyMs: Date.now() - started } };
    } catch (e) {
      return { ok: true, data: { protocol: "imap", ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "IMAP connect failed" } };
    }
  } catch (err) {
    return failUnexpected(err);
  }
}

/* ---------------- Audit log (admin, read) ---------------- */
export async function listAuditLogAction(filters: {
  actorId?: string | null;
  action?: string | null;
  query?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}): Promise<ActionResult<{ entries: Array<Record<string, unknown>> }>> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    let q = supabase
      .from("audit_log")
      .select("id,actor_id,action,entity_type,entity_id,meta,created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(filters.limit ?? 100, 500));
    if (filters.actorId) q = q.eq("actor_id", filters.actorId);
    if (filters.action) q = q.eq("action", filters.action);
    if (filters.query) q = q.or(`action.ilike.%${filters.query}%,entity_id.ilike.%${filters.query}%`);
    if (filters.from) q = q.gte("created_at", filters.from);
    if (filters.to) q = q.lte("created_at", filters.to);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: { entries: data ?? [] } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Update a team member (name, role, phone) — admin only. */
export async function updateTeamUserAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireAdmin();
    const parsed = z.object({
      userId: z.string().uuid(),
      fullName: z.string().trim().min(2).max(120),
      role: z.enum(["admin", "staff"]),
      phone: z.string().max(40).nullable().optional(),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const { userId, fullName, role, phone } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    // Last-admin guard: demoting the last admin is blocked.
    if (role !== "admin") {
      const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
      if (target?.role === "admin") {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
        if ((count ?? 0) <= 1) return fail("validation", "You cannot demote the last active admin.");
      }
    }
    const { error } = await supabase.from("profiles").update({ full_name: fullName, role, phone: phone ?? null, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) throw error;
    const service = createServiceClient();
    await service.auth.admin.updateUserById(userId, { user_metadata: { role } });
    await logAudit(supabase, {action: "user.update", entityType: "user", entityId: userId, meta: { role, full_name: fullName }});
    revalidatePath("/settings/team");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Update a room's amenities / notes / rate / capacity / name — admin only. */
export async function updateRoomAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireAdmin();
    const parsed = z.object({
      roomId: z.string().uuid(),
      amenities: z.array(z.string().max(40)).max(20).optional(),
      notes: z.string().max(500).nullable().optional(),
      hourlyRate: z.number().min(0).max(100_000).optional(),
      capacity: z.number().int().min(1).max(1000).optional(),
      name: z.string().trim().min(2).max(120).optional(),
      location: z.string().trim().min(2).max(80).optional(),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { roomId, ...patch } = parsed.data;
    const update: Record<string, unknown> = {};
    if (patch.amenities !== undefined) update.amenities = patch.amenities;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.hourlyRate !== undefined) update.hourly_rate = patch.hourlyRate;
    if (patch.location !== undefined) update.location = patch.location;
    if (patch.capacity !== undefined) update.capacity = patch.capacity;
    if (patch.name !== undefined) update.name = patch.name;
    if (Object.keys(update).length === 0) return { ok: true, data: { ok: true } };
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("rooms").update({ ...update, updated_at: new Date().toISOString() }).eq("id", roomId);
    if (error) throw error;
    await logAudit(supabase, {action: "room.update", entityType: "room", entityId: roomId, meta: update});
    revalidatePath("/settings/rooms");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Toggle a category active/inactive. */
export async function toggleCategoryActiveAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireAdmin();
    const parsed = z.object({ categoryId: z.string().uuid(), isActive: z.boolean() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { categoryId, isActive } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("categories").update({ is_active: isActive }).eq("id", categoryId);
    if (error) throw error;
    await logAudit(supabase, {action: "category.toggle", entityType: "category", entityId: categoryId, meta: { is_active: isActive }});
    revalidatePath("/settings/categories");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Rename / recolor a category. */
export async function updateCategoryAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireAdmin();
    const parsed = z.object({
      categoryId: z.string().uuid(),
      nameEn: z.string().trim().min(2).max(80).optional(),
      nameFr: z.string().trim().max(80).nullable().optional(),
      color: z.string().max(30).optional(),
      icon: z.string().max(60).optional(),
      sort: z.number().int().min(0).max(999).optional(),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { categoryId, ...patch } = parsed.data;
    const update: Record<string, unknown> = {};
    if (patch.nameEn !== undefined) update.name_en = patch.nameEn;
    if (patch.nameFr !== undefined) update.name_fr = patch.nameFr;
    if (patch.color !== undefined) update.color = patch.color;
    if (patch.icon !== undefined) update.icon = patch.icon;
    if (patch.sort !== undefined) update.sort = patch.sort;
    if (Object.keys(update).length === 0) return { ok: true, data: { ok: true } };
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("categories").update(update).eq("id", categoryId);
    if (error) throw error;
    await logAudit(supabase, {action: "category.update", entityType: "category", entityId: categoryId, meta: update});
    revalidatePath("/settings/categories");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Delete a NON-system category (system entries refuse). */
export async function deleteCategoryAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireAdmin();
    const parsed = z.object({ categoryId: z.string().uuid() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: cat } = await supabase.from("categories").select("is_system,name_en").eq("id", parsed.data.categoryId).single();
    if (!cat) return fail("not_found", "Category not found.");
    if (cat.is_system) return fail("forbidden", "System categories cannot be deleted — rename them instead.");
    const { error } = await supabase.from("categories").delete().eq("id", parsed.data.categoryId);
    if (error) throw error;
    await logAudit(supabase, {action: "category.delete", entityType: "category", entityId: parsed.data.categoryId, meta: { name_en: cat.name_en }});
    revalidatePath("/settings/categories");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}
