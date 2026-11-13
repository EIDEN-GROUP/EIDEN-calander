/**
 * Demo store — sessionStorage-backed external store (useSyncExternalStore).
 * Module-level caches keep getSnapshot referentially stable; writes publish
 * to all subscribers. Falls back to the canonical demo dataset when empty.
 * Server snapshot = DEMO_* constants (hydration-safe).
 *
 * TODO(WIRE): swap reads/writes for Supabase queries (plans + plan_tasks
 * tables, owner_id / assignee_id keys) behind the same function signatures.
 */

import { DEMO_PLANS, DEMO_PLAN_TASKS } from "@/lib/demo-data";
import type { PlanRow, PlanTaskRow } from "@/lib/types/db";

const PLANS_KEY = "calendar.demo.plans.v1";
const TASKS_KEY = "calendar.demo.tasks.v1";

let plansCache: PlanRow[] | null = null;
let tasksCache: PlanTaskRow[] | null = null;

const listeners = new Set<() => void>();

export function subscribeDemoStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  listeners.forEach((l) => l());
}

function readRaw<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — demo stays in memory only.
  }
}

export function getPlansSnapshot(): PlanRow[] {
  if (plansCache === null) {
    plansCache = readRaw(PLANS_KEY, DEMO_PLANS);
  }
  return plansCache;
}

export function getTasksSnapshot(): PlanTaskRow[] {
  if (tasksCache === null) {
    tasksCache = readRaw(TASKS_KEY, DEMO_PLAN_TASKS);
  }
  return tasksCache;
}

export const getPlansServerSnapshot = (): PlanRow[] => DEMO_PLANS;
export const getTasksServerSnapshot = (): PlanTaskRow[] => DEMO_PLAN_TASKS;

/** True after client hydration of the demo store (server snapshot = false). */
export const getClientReadySnapshot = (): boolean => typeof window !== "undefined";
export const getClientReadyServerSnapshot = (): boolean => false;

export function writeDemoPlans(plans: PlanRow[]): void {
  plansCache = plans;
  safeWrite(PLANS_KEY, plans);
  emit();
}

export function writeDemoTasks(tasks: PlanTaskRow[]): void {
  tasksCache = tasks;
  safeWrite(TASKS_KEY, tasks);
  emit();
}

/** Recompute plan.progress from its tasks (done / total, 0 when empty). */
export function deriveProgress(tasks: PlanTaskRow[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}
