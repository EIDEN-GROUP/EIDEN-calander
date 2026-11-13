/**
 * Plans — live data loader (server-only).
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PlanRow, PlanTaskRow, ProfileRow } from "@/lib/types/db";

export interface PlansData {
  live: boolean;
  plans: PlanRow[];
  tasks: PlanTaskRow[];
  members: Array<Pick<ProfileRow, "id" | "full_name" | "role">>;
}

export async function loadPlans(): Promise<PlansData | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const [plans, tasks, members] = await Promise.all([
      supabase.from("plans").select("id,title,description,owner_id,status,priority,start_date,target_date,progress,target_date_marker").order("start_date", { ascending: true }),
      supabase.from("plan_tasks").select("id,plan_id,title,assignee_id,due_date,status,position,completed_at").order("position"),
      supabase.from("profiles").select("id,full_name,role").eq("is_active", true).order("full_name"),
    ]);
    if (plans.error) throw plans.error;
    if (tasks.error) throw tasks.error;
    if (members.error) throw members.error;
    return {
      live: true,
      plans: (plans.data ?? []) as PlanRow[],
      tasks: (tasks.data ?? []) as PlanTaskRow[],
      members: (members.data ?? []) as PlansData["members"],
    };
  } catch (e) {
    console.error("[plans] live load failed:", e);
    return null;
  }
}

export async function loadPlan(id: string): Promise<PlansData | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data: plan, error } = await supabase
      .from("plans")
      .select("id,title,description,owner_id,status,priority,start_date,target_date,progress,target_date_marker")
      .eq("id", id)
      .single();
    if (error || !plan) return null;
    const [tasks, members] = await Promise.all([
      supabase.from("plan_tasks").select("id,plan_id,title,assignee_id,due_date,status,position,completed_at").eq("plan_id", id).order("position"),
      supabase.from("profiles").select("id,full_name,role").eq("is_active", true).order("full_name"),
    ]);
    if (tasks.error) throw tasks.error;
    if (members.error) throw members.error;
    return {
      live: true,
      plans: [plan as PlanRow],
      tasks: (tasks.data ?? []) as PlanTaskRow[],
      members: (members.data ?? []) as PlansData["members"],
    };
  } catch (e) {
    console.error("[plans] live load failed:", e);
    return null;
  }
}
