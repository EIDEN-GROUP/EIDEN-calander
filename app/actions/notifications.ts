"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { ActionResult, NotificationRow } from "@/lib/types/db";

export async function listNotificationsAction(limit = 50): Promise<ActionResult<{ notifications: NotificationRow[]; unread: number }>> {
  try {
    const profile = await requireUser();
    const supabase = await createClient();
    if (!supabase) return { ok: true, data: { notifications: [], unread: 0 } };
    const { data, error } = await supabase
      .from("notifications")
      .select("id,user_id,type,title,body,link,entity_id,read_at,created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) throw error;
    const notifications = (data ?? []) as NotificationRow[];
    return { ok: true, data: { notifications, unread: notifications.filter((n) => !n.read_at).length } };
  } catch (err) {
    console.error("[notifications] list failed", err);
    return { ok: false, error: { code: "unexpected", message: "Couldn't load notifications." } };
  }
}

export async function unreadNotificationCountAction(): Promise<number> {
  try {
    const profile = await requireUser();
    const supabase = await createClient();
    if (!supabase) return 0;
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null);
    if (error) throw error;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ updated: number }>> {
  try {
    const profile = await requireUser();
    const supabase = await createClient();
    if (!supabase) return { ok: true, data: { updated: 0 } };
    const { data, error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .is("read_at", null)
      .select("id");
    if (error) throw error;
    revalidatePath("/notifications");
    return { ok: true, data: { updated: data?.length ?? 0 } };
  } catch (err) {
    console.error("[notifications] mark all failed", err);
    return { ok: false, error: { code: "unexpected", message: "Couldn't mark as read." } };
  }
}

export async function markNotificationReadAction(raw: unknown): Promise<ActionResult<{ updated: number }>> {
  try {
    const profile = await requireUser();
    const supabase = await createClient();
    if (!supabase) return { ok: true, data: { updated: 0 } };
    const id = (raw as { id?: string })?.id;
    if (!id) return { ok: false, error: { code: "validation", message: "Missing id" } };
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", profile.id);
    if (error) throw error;
    revalidatePath("/notifications");
    return { ok: true, data: { updated: 1 } };
  } catch (err) {
    console.error("[notifications] mark failed", err);
    return { ok: false, error: { code: "unexpected", message: "Couldn't mark as read." } };
  }
}
