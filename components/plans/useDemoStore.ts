"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PlanRow, PlanTaskRow } from "@/lib/types/db";
import {
  deriveProgress,
  getClientReadyServerSnapshot,
  getClientReadySnapshot,
  getPlansServerSnapshot,
  getPlansSnapshot,
  getTasksServerSnapshot,
  getTasksSnapshot,
  subscribeDemoStore,
  writeDemoPlans,
  writeDemoTasks,
} from "./demo-store";

const noopSubscribe = () => () => {};

/** True after client hydration of the demo store (server snapshot = false). */
export function useDemoStoreReady(): boolean {
  return useSyncExternalStore(noopSubscribe, getClientReadySnapshot, getClientReadyServerSnapshot);
}

/**
 * Plans + tasks from the session demo store, with stable commit helpers.
 * Commits write through to sessionStorage and fan out to every subscriber.
 */
export function useDemoStore() {
  const plans = useSyncExternalStore(subscribeDemoStore, getPlansSnapshot, getPlansServerSnapshot);
  const tasks = useSyncExternalStore(subscribeDemoStore, getTasksSnapshot, getTasksServerSnapshot);

  const commitPlans = useCallback((updater: (prev: PlanRow[]) => PlanRow[]) => {
    writeDemoPlans(updater(getPlansSnapshot()));
  }, []);

  /** Commit a task change AND keep dependent plan progress in sync atomically. */
  const commitTasks = useCallback(
    (updater: (prev: PlanTaskRow[]) => PlanTaskRow[], syncProgressForPlanId?: string) => {
      const next = updater(getTasksSnapshot());
      writeDemoTasks(next);
      if (syncProgressForPlanId) {
        const derived = deriveProgress(next.filter((t) => t.plan_id === syncProgressForPlanId));
        const currentPlans = getPlansSnapshot();
        const target = currentPlans.find((p) => p.id === syncProgressForPlanId);
        if (target && target.progress !== derived && target.status !== "completed") {
          writeDemoPlans(
            currentPlans.map((p) =>
              p.id === syncProgressForPlanId ? { ...p, progress: derived } : p,
            ),
          );
        }
      }
    },
    [],
  );

  return { plans, tasks, commitPlans, commitTasks };
}
