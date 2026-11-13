"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/types/db";

function notConfigured<T>(): ActionResult<T> {
  return { ok: false, error: { code: "not_configured", message: "Supabase isn't configured — set .env." } };
}
function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}
function failUnexpected(err: unknown): ActionResult<never> {
  console.error("[plans] unexpected error", err);
  return { ok: false, error: { code: "unexpected", message: "Something went wrong. Please try again." } };
}

const planInput = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(2000).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).default("planning"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  showOnCalendar: z.boolean().optional(),
});

export async function createPlanAction(raw: unknown): Promise<ActionResult<{ planId: string }>> {
  try {
    const profile = await requireUser();
    const parsed = planInput.safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const input = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: inserted, error } = await supabase
      .from("plans")
      .insert({
        title: input.title,
        description: input.description ?? null,
        owner_id: input.ownerId ?? profile.id,
        status: input.status,
        priority: input.priority,
        start_date: input.startDate ?? null,
        target_date: input.targetDate ?? null,
        target_date_marker: input.showOnCalendar ?? false,
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabase.from("audit_log").insert({ actor_id: profile.id, action: "plan.create", entity_type: "plan", entity_id: inserted.id });
    revalidatePath("/plans");
    return { ok: true, data: { planId: inserted.id } };
  } catch (err) {
    return failUnexpected(err);
  }
}

export async function updatePlanStatusAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const profile = await requireUser();
    const parsed = z.object({
      planId: z.string().uuid(),
      status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("plans").update({ status: parsed.data.status }).eq("id", parsed.data.planId);
    if (error) throw error;
    await supabase.from("audit_log").insert({ actor_id: profile.id, action: "plan.status", entity_type: "plan", entity_id: parsed.data.planId, meta: { status: parsed.data.status } });
    revalidatePath("/plans");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

export async function addPlanTaskAction(raw: unknown): Promise<ActionResult<{ taskId: string }>> {
  try {
    await requireUser();
    const parsed = z.object({
      planId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      assigneeId: z.string().uuid().nullable().optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { data: last } = await supabase
      .from("plan_tasks").select("position").eq("plan_id", parsed.data.planId).order("position", { ascending: false }).limit(1);
    const nextPosition = ((last?.[0]?.position as number | undefined) ?? 0) + 1;
    const { data: inserted, error } = await supabase
      .from("plan_tasks")
      .insert({
        plan_id: parsed.data.planId,
        title: parsed.data.title,
        assignee_id: parsed.data.assigneeId ?? null,
        due_date: parsed.data.dueDate ?? null,
        position: nextPosition,
        status: "todo",
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath(`/plans/${parsed.data.planId}`);
    return { ok: true, data: { taskId: inserted.id } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Cycle a task todo → in_progress → done → todo (done sets completed_at). */
export async function cyclePlanTaskAction(raw: unknown): Promise<ActionResult<{ status: "todo" | "in_progress" | "done" }>> {
  try {
    await requireUser();
    const parsed = z.object({ taskId: z.string().uuid(), status: z.enum(["todo", "in_progress", "done"]) }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { taskId, status } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase
      .from("plan_tasks")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", taskId);
    if (error) throw error;
    revalidatePath("/plans");
    return { ok: true, data: { status } };
  } catch (err) {
    return failUnexpected(err);
  }
}

export async function deletePlanTaskAction(raw: unknown): Promise<ActionResult<{ deleted: true }>> {
  try {
    await requireUser();
    const parsed = z.object({ taskId: z.string().uuid() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("plan_tasks").delete().eq("id", parsed.data.taskId);
    if (error) throw error;
    revalidatePath("/plans");
    return { ok: true, data: { deleted: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

export async function deletePlanAction(raw: unknown): Promise<ActionResult<{ deleted: true }>> {
  try {
    const admin = await requireAdmin();
    const parsed = z.object({ planId: z.string().uuid() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("plans").delete().eq("id", parsed.data.planId);
    if (error) throw error;
    await supabase.from("audit_log").insert({ actor_id: admin.id, action: "plan.delete", entity_type: "plan", entity_id: parsed.data.planId });
    revalidatePath("/plans");
    return { ok: true, data: { deleted: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Toggle the "show on calendar" marker for a plan. */
export async function togglePlanCalendarMarkerAction(raw: unknown): Promise<ActionResult<{ on: boolean }>> {
  try {
    await requireUser();
    const parsed = z.object({ planId: z.string().uuid(), on: z.boolean() }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    const { error } = await supabase.from("plans").update({ target_date_marker: parsed.data.on }).eq("id", parsed.data.planId);
    if (error) throw error;
    revalidatePath(`/plans/${parsed.data.planId}`);
    revalidatePath("/plans");
    return { ok: true, data: { on: parsed.data.on } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Persist task order after drag-reorder. */
export async function reorderPlanTasksAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    await requireUser();
    const parsed = z.object({
      planId: z.string().uuid(),
      orderedIds: z.array(z.string().uuid()).min(1).max(200),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", "Invalid input");
    const { planId, orderedIds } = parsed.data;
    const supabase = await createClient();
    if (!supabase) return notConfigured();
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase.from("plan_tasks").update({ position: i + 1 }).eq("id", orderedIds[i]).eq("plan_id", planId);
      if (error) throw error;
    }
    revalidatePath(`/plans/${planId}`);
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}
