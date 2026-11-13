"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FormEvent, KeyboardEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Flag,
  GripVertical,
  MessageSquare,
  Plus,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { Toast } from "@/components/bookings/Toast";
import { useDemoToast } from "@/components/charts/useDemoToast";
import { Switch } from "@/components/charts/Switch";
import { useDemoStore, useDemoStoreReady } from "./useDemoStore";
import { setLiveStaff } from "./demo-staff";
import {
  addPlanTaskAction,
  cyclePlanTaskAction,
  deletePlanTaskAction,
  reorderPlanTasksAction,
  togglePlanCalendarMarkerAction,
  updatePlanStatusAction,
} from "@/app/actions/plans";
import { useRouter } from "next/navigation";
import type { PlansData } from "@/lib/plans-live";
import { deriveProgress } from "./demo-store";
import type { PlanRow, PlanStatus, PlanTaskRow, TaskStatus } from "@/lib/types/db";
import { getStaff } from "./demo-staff";
import { AvatarInitials } from "./AvatarInitials";
import { PlanStatusSelect, PriorityChip } from "./chips";
import { ProgressRing } from "./ProgressRing";
import {
  formatFullDate,
  formatShortDate,
  isOverdueDate,
  relativeDayLabel,
} from "@/components/charts/format";

const TASK_CYCLE: TaskStatus[] = ["todo", "in_progress", "done"];
const TASK_PILL: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "To do", className: "bg-track text-obsidian-light" },
  in_progress: { label: "In progress", className: "bg-electric-tint text-electric" },
  done: { label: "Done", className: "bg-success-tint text-tint-fg-green" },
};

type TaskSort = "manual" | "due";

const dueCompare = (a: PlanTaskRow, b: PlanTaskRow) => {
  const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
  const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  return a.position - b.position;
};

export function PlanDetail({ id, data }: { id: string; data?: PlansData | null }) {
  const router = useRouter();
  const live = data?.live === true;
  const { toast, showToast, dismiss } = useDemoToast();

  useEffect(() => {
    if (data?.members?.length) setLiveStaff(data.members);
  }, [data]);

  const { plans, tasks, commitPlans, commitTasks } = useDemoStore();
  const storeHydrated = useDemoStoreReady();
  const hydrated = live || storeHydrated;
  const [livePlans, setLivePlans] = useState<PlanRow[]>(data?.plans ?? []);
  const [liveTasks, setLiveTasks] = useState<PlanTaskRow[]>(data?.tasks ?? []);
  useEffect(() => {
    setLivePlans(data?.plans ?? []);
    setLiveTasks(data?.tasks ?? []);
  }, [data]);
  const plansView = live ? livePlans : plans;
  const tasksView = live ? liveTasks : tasks;
  const [sort, setSort] = useState<TaskSort>("manual");
  const [draft, setDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; before: boolean } | null>(null);

  const plan = plansView.find((p) => p.id === id) ?? null;

  const planTasks = useMemo(() => tasksView.filter((t) => t.plan_id === id), [tasksView, id]);

  const visibleTasks = useMemo(() => {
    const list = [...planTasks];
    return sort === "due" ? list.sort(dueCompare) : list.sort((a, b) => a.position - b.position);
  }, [planTasks, sort]);

  const doneCount = planTasks.filter((t) => t.status === "done").length;
  const totalCount = planTasks.length;
  const progress = deriveProgress(planTasks);

  const updatePlan = useCallback(
    (patch: Partial<PlanRow>) => {
      if (live) {
        if (patch.status) {
          setLivePlans((prev) => prev.map((p) => (p.id === id ? { ...p, status: patch.status! } : p)));
          void updatePlanStatusAction({ planId: id, status: patch.status }).then(() => router.refresh());
        }
        if (patch.target_date_marker !== undefined) {
          setLivePlans((prev) => prev.map((p) => (p.id === id ? { ...p, target_date_marker: patch.target_date_marker! } : p)));
          void togglePlanCalendarMarkerAction({ planId: id, on: patch.target_date_marker }).then(() => router.refresh());
        }
        return;
      }
      commitPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [commitPlans, id, live, router],
  );

  /* ---------- task mutations ---------- */

  const toggleTask = (task: PlanTaskRow) => {
    const nextDone = task.status !== "done";
    if (live) {
      const next = nextDone ? "done" : "todo";
      setLiveTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: next, completed_at: nextDone ? new Date().toISOString() : null } : t)),
      );
      void cyclePlanTaskAction({ taskId: task.id, status: next }).then(() => router.refresh());
      return;
    }
    commitTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextDone ? "done" : "todo",
              completed_at: nextDone ? new Date().toISOString() : null,
            }
          : t,
      ),
      id,
    );
  };

  const cycleStatus = (task: PlanTaskRow) => {
    const idx = TASK_CYCLE.indexOf(task.status);
    const next = TASK_CYCLE[(idx + 1) % TASK_CYCLE.length];
    if (live) {
      setLiveTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: next, completed_at: next === "done" ? new Date().toISOString() : null } : t)),
      );
      void cyclePlanTaskAction({ taskId: task.id, status: next }).then(() => router.refresh());
      return;
    }
    commitTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: next,
              completed_at: next === "done" ? new Date().toISOString() : null,
            }
          : t,
      ),
      id,
    );
  };

  const deleteTask = (taskId: string) => {
    if (live) {
      setLiveTasks((prev) => prev.filter((t) => t.id !== taskId));
      void deletePlanTaskAction({ taskId }).then(() => router.refresh());
      setConfirmDeleteId(null);
      return;
    }
    commitTasks((prev) => {
      const remaining = prev.filter((t) => t.id !== taskId && t.plan_id === id);
      const others = prev.filter((t) => t.plan_id !== id);
      const reindexed = [...remaining]
        .sort((a, b) => a.position - b.position)
        .map((t, i) => ({ ...t, position: i + 1 }));
      return [...others, ...reindexed];
    }, id);
    setConfirmDeleteId(null);
  };

  const addTask = (e?: FormEvent) => {
    e?.preventDefault();
    const title = draft.trim();
    if (!title || !plan) return;
    if (live) {
      const position = planTasks.reduce((m, t) => Math.max(m, t.position), 0) + 1;
      void addPlanTaskAction({ planId: plan.id, title, assigneeId: plan.owner_id }).then((res) => {
        if (!res.ok) {
          showToast(res.error.message, undefined, "warning");
          return;
        }
        router.refresh();
      });
      setDraft("");
      return;
    }
    commitTasks((prev) => {
      const mine = prev.filter((t) => t.plan_id === plan.id);
      const position = mine.reduce((m, t) => Math.max(m, t.position), 0) + 1;
      return [
        ...prev,
        {
          id: `t-${Date.now().toString(36)}`,
          plan_id: plan.id,
          title,
          assignee_id: plan.owner_id,
          due_date: null,
          status: "todo",
          position,
          completed_at: null,
        },
      ];
    }, id);
    setDraft("");
  };

  const reorderTasks = (dragId: string, targetId: string, before: boolean) => {
    if (dragId === targetId) return;
    if (live) {
      const mine = [...planTasks].sort((a, b) => a.position - b.position);
      const dragged = mine.find((t) => t.id === dragId);
      const rest = mine.filter((t) => t.id !== dragId);
      const targetIdx = rest.findIndex((t) => t.id === targetId);
      if (!dragged || targetIdx === -1) return;
      const insertAt = before ? targetIdx : targetIdx + 1;
      const ordered = [...rest.slice(0, insertAt), dragged, ...rest.slice(insertAt)].map((t, i) => ({ ...t, position: i + 1 }));
      setLiveTasks(ordered);
      void reorderPlanTasksAction({ planId: id, orderedIds: ordered.map((t) => t.id) }).then(() => router.refresh());
      setSort("manual");
      setDragTaskId(null);
      setDropHint(null);
      return;
    }
    commitTasks((prev) => {
      const mine = prev
        .filter((t) => t.plan_id === id)
        .sort((a, b) => a.position - b.position);
      const others = prev.filter((t) => t.plan_id !== id);
      const dragged = mine.find((t) => t.id === dragId);
      const rest = mine.filter((t) => t.id !== dragId);
      const targetIdx = rest.findIndex((t) => t.id === targetId);
      if (!dragged || targetIdx === -1) return prev;
      const insertAt = before ? targetIdx : targetIdx + 1;
      const next = [...rest.slice(0, insertAt), dragged, ...rest.slice(insertAt)].map(
        (t, i) => ({ ...t, position: i + 1 }),
      );
      return [...others, ...next];
    });
    setSort("manual");
    setDragTaskId(null);
    setDropHint(null);
  };

  const toggleMarker = (next: boolean) => {
    updatePlan({ target_date_marker: next });
    showToast(next ? "Marker shown on calendar" : "Calendar marker hidden", plan?.title, "success");
  };

  const changeStatus = (next: PlanStatus) => {
    updatePlan({
      status: next,
      progress: next === "completed" ? 100 : plan?.progress ?? 0,
    });
  };

  /* ---------- render ---------- */

  // Not-found (client navigation to an unknown id) vs. hydration skeleton.
  if (!plan) {
    if (!hydrated) {
      return (
        <div className="mx-auto max-w-[1440px] animate-pulse space-y-4" aria-hidden="true">
          <div className="h-4 w-48 rounded-pill bg-track" />
          <div className="card h-48 bg-white" />
          <div className="card h-72 bg-white" />
        </div>
      );
    }
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-md border border-border bg-white px-6 py-16 text-center shadow-sm">
        <CircleAlert size={28} strokeWidth={1.8} className="text-warning" aria-hidden="true" />
        <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.02em] text-obsidian">
          Plan not found
        </h1>
        <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-obsidian-light">
          “{id}” does not exist in the demo dataset — it may have been created in another tab’s
          session.
        </p>
        <Link href="/plans" className="btn btn-primary mt-6 h-11">
          Back to plans
        </Link>
      </div>
    );
  }

  const owner = getStaff(plan.owner_id);
  const overdueTarget =
    plan.status !== "completed" && plan.status !== "cancelled" && isOverdueDate(plan.target_date);
  const relTarget = plan.target_date ? relativeDayLabel(plan.target_date) : null;
  const targetIsPast = relTarget === null && plan.target_date !== null;

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        <Link href="/plans" className="rounded-sm transition-colors hover:text-electric">
          Plans
        </Link>
        <ChevronRight size={12} strokeWidth={2.4} aria-hidden="true" />
        <span aria-current="page" className="max-w-[60%] truncate text-obsidian">
          {plan.title}
        </span>
      </nav>

      <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ========== MAIN COLUMN ========== */}
        <div className="min-w-0 space-y-4">
          {/* Header card */}
          <section className="card p-5 sm:p-6" aria-labelledby="plan-title">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0 flex-1 basis-72">
                <h1
                  id="plan-title"
                  className="text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-obsidian sm:text-[27px]"
                >
                  {plan.title}
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <PlanStatusSelect status={plan.status} onChange={changeStatus} />
                  <PriorityChip priority={plan.priority} />
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-canvas py-1 pl-1 pr-2.5 text-[11px] font-semibold text-obsidian-light">
                    <AvatarInitials id={plan.owner_id} size={18} />
                    {owner.name}
                  </span>
                </div>
                <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-medium text-obsidian-light">
                  <div className="inline-flex items-center gap-1.5">
                    <CalendarClock size={13} strokeWidth={2.2} className="text-muted" aria-hidden="true" />
                    <dt className="sr-only">Started</dt>
                    <dd className="font-mono tabular-nums">
                      {plan.start_date ? `Started ${formatFullDate(plan.start_date)}` : "Not started"}
                    </dd>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <Flag size={13} strokeWidth={2.2} className="text-muted" aria-hidden="true" />
                    <dt className="sr-only">Target</dt>
                    <dd className="font-mono tabular-nums">
                      {plan.target_date ? `Target ${formatFullDate(plan.target_date)}` : "No target date"}
                      {relTarget && (
                        <span className="ml-1.5 font-sans font-bold text-electric">({relTarget})</span>
                      )}
                      {overdueTarget && (
                        <span className="ml-1.5 inline-flex items-center gap-1 rounded-pill bg-error-tint px-2 py-0.5 align-middle font-sans text-[10px] font-bold uppercase tracking-wide text-error">
                          Overdue
                        </span>
                      )}
                      {!overdueTarget && targetIsPast && plan.status === "completed" && (
                        <span className="ml-1.5 font-sans font-bold text-success">· closed</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Ring + calendar toggle */}
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <ProgressRing
                  value={progress}
                  size={124}
                  stroke={11}
                  label={`Completion for ${plan.title}`}
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">
                  Derived from tasks
                </p>
                <div className="mt-2 border-t border-divider pt-2.5">
                  <Switch
                    id="show-on-calendar"
                    checked={plan.target_date_marker}
                    onChange={toggleMarker}
                    label="Show on calendar"
                  />
                </div>
              </div>
            </div>
            <p className="mt-4 border-t border-divider pt-4 text-[13.5px] font-medium leading-relaxed text-obsidian-light">
              {plan.description ?? "No description yet — outline the objective, the milestones and what “done” looks like."}
            </p>
          </section>

          {/* Tasks card */}
          <section className="card p-5" aria-labelledby="tasks-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="tasks-heading"
                className="flex items-center gap-2.5 text-[16px] font-bold tracking-[-0.01em] text-obsidian"
              >
                Tasks
                <span className="rounded-pill bg-track px-2.5 py-0.5 font-mono text-[11px] font-bold text-obsidian-light tabular-nums">
                  {doneCount}/{totalCount}
                </span>
              </h2>
              <div className="segmented" role="group" aria-label="Sort tasks">
                <button
                  type="button"
                  className={`segment ${sort === "due" ? "segment-active" : ""}`}
                  aria-pressed={sort === "due"}
                  onClick={() => setSort("due")}
                >
                  Due date
                </button>
                <button
                  type="button"
                  className={`segment ${sort === "manual" ? "segment-active" : ""}`}
                  aria-pressed={sort === "manual"}
                  onClick={() => setSort("manual")}
                >
                  Manual
                </button>
              </div>
            </div>

            {/* Inline add */}
            <form onSubmit={addTask} className="mt-4 flex gap-2">
              <label htmlFor="new-task" className="sr-only">
                Add a task
              </label>
              <input
                id="new-task"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTask();
                  }
                }}
                placeholder="Add a task… (Enter to add)"
                className="input h-10 flex-1 text-[13px]"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="btn btn-primary h-10 px-4 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} strokeWidth={2.6} aria-hidden="true" />
                Add
              </button>
            </form>

            {/* Task list */}
            <ul className="mt-2 divide-y divide-divider">
              {visibleTasks.map((task) => {
                const taskOverdue = isOverdueDate(task.due_date) && task.status !== "done";
                const assignee = getStaff(task.assignee_id);
                const pill = TASK_PILL[task.status];
                const isDone = task.status === "done";
                const confirming = confirmDeleteId === task.id;
                const dropClass =
                  dropHint?.id === task.id
                    ? dropHint.before
                      ? "shadow-[inset_0_2px_0_0_var(--color-electric)]"
                      : "shadow-[inset_0_-2px_0_0_var(--color-electric)]"
                    : "";
                return (
                  <li
                    key={task.id}
                    onDragOver={(e) => {
                      if (!dragTaskId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      const before = e.clientY < rect.top + rect.height / 2;
                      setDropHint((hint) =>
                        hint?.id === task.id && hint.before === before
                          ? hint
                          : { id: task.id, before },
                      );
                    }}
                    onDragLeave={() =>
                      setDropHint((hint) => (hint?.id === task.id ? null : hint))
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragId = e.dataTransfer.getData("text/task-id") || dragTaskId;
                      if (dragId) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        reorderTasks(dragId, task.id, e.clientY < rect.top + rect.height / 2);
                      }
                    }}
                    className={`flex items-center gap-2.5 rounded-sm py-2.5 transition-shadow ${dropClass} ${
                      dragTaskId === task.id ? "opacity-50" : ""
                    }`}
                  >
                    {/* Drag handle */}
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/task-id", task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragTaskId(task.id);
                      }}
                      onDragEnd={() => {
                        setDragTaskId(null);
                        setDropHint(null);
                      }}
                      aria-label={`Reorder task: ${task.title}`}
                      className="cursor-grab touch-none rounded-xs p-1 text-muted transition-colors hover:text-obsidian focus-visible:text-electric active:cursor-grabbing"
                    >
                      <GripVertical size={16} strokeWidth={2} aria-hidden="true" />
                    </button>

                    {/* Done checkbox */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isDone}
                      aria-label={isDone ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`}
                      onClick={() => toggleTask(task)}
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition-all duration-150 ${
                        isDone
                          ? "border-electric bg-electric"
                          : "border-black/15 bg-white hover:border-electric"
                      }`}
                    >
                      {isDone && <Check size={12} strokeWidth={3.2} className="text-white" aria-hidden="true" />}
                    </button>

                    {/* Title */}
                    <span
                      className={`min-w-0 flex-1 text-[13.5px] font-medium leading-snug transition-colors duration-150 ${
                        isDone ? "text-muted line-through decoration-muted/70" : "text-obsidian"
                      }`}
                      title={task.completed_at ? `Completed ${formatFullDate(task.completed_at)}` : undefined}
                    >
                      {task.title}
                    </span>

                    {/* Assignee */}
                    <span className="hidden shrink-0 items-center gap-1.5 md:inline-flex" title={`Assignee: ${assignee.name}`}>
                      <AvatarInitials id={task.assignee_id} size={20} />
                      <span className="max-w-[72px] truncate text-[11px] font-semibold text-obsidian-light">
                        {assignee.name}
                      </span>
                    </span>

                    {/* Due date */}
                    {task.due_date && (
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                          taskOverdue ? "inline-flex items-center gap-1 bg-error-tint text-error" : "text-obsidian-light"
                        }`}
                      >
                        {taskOverdue && <CircleAlert size={10} strokeWidth={2.6} aria-hidden="true" />}
                        {formatShortDate(task.due_date)}
                        {taskOverdue && <span className="font-sans font-bold uppercase">· Overdue</span>}
                      </span>
                    )}

                    {/* Status pill (cycles on click) */}
                    <button
                      type="button"
                      onClick={() => cycleStatus(task)}
                      aria-label={`Status: ${pill.label}. Activate to advance to ${
                        TASK_PILL[TASK_CYCLE[(TASK_CYCLE.indexOf(task.status) + 1) % TASK_CYCLE.length]].label
                      }`}
                      title="Click to cycle: To do → In progress → Done"
                      className={`shrink-0 whitespace-nowrap rounded-pill px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-transform hover:scale-[1.04] ${pill.className}`}
                    >
                      {pill.label}
                    </button>

                    {/* Delete with inline confirm */}
                    {confirming ? (
                      <span
                        className="flex shrink-0 items-center gap-1.5 rounded-pill bg-error-tint py-1 pl-2.5 pr-1.5"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setConfirmDeleteId(null);
                        }}
                      >
                        <span className="text-[10.5px] font-bold text-error">Delete?</span>
                        <button
                          type="button"
                          ref={(el) => el?.focus()}
                          onClick={() => deleteTask(task.id)}
                          className="rounded-pill bg-error px-2 py-0.5 text-[10.5px] font-bold text-white transition-opacity hover:opacity-90"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-pill px-2 py-0.5 text-[10.5px] font-bold text-obsidian-light transition-colors hover:bg-white"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(task.id)}
                        aria-label={`Delete task: ${task.title}`}
                        className="shrink-0 rounded-pill p-1.5 text-muted transition-colors hover:bg-error-tint hover:text-error"
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
              {visibleTasks.length === 0 && (
                <li className="flex flex-col items-center gap-2 py-8 text-center">
                  <CheckCircle2 size={22} strokeWidth={1.8} className="text-success" aria-hidden="true" />
                  <p className="text-[13px] font-semibold text-obsidian-light">No tasks yet — add the first one above.</p>
                </li>
              )}
            </ul>
          </section>
        </div>

        {/* ========== RIGHT COLUMN (XL) ========== */}
        <aside className="min-w-0 space-y-4">
          {/* Activity timeline */}
          <section className="card p-5" aria-labelledby="activity-heading">
            <h2
              id="activity-heading"
              className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em] text-obsidian"
            >
              <Activity size={16} strokeWidth={2} className="text-muted" aria-hidden="true" />
              Activity
            </h2>
            <ol className="relative mt-4 space-y-4 border-l border-divider pl-5">
              {[
                {
                  icon: <CheckCircle2 size={14} strokeWidth={2.2} className="text-success" aria-hidden="true" />,
                  body: (
                    <>
                      <b className="font-bold text-obsidian">Yasmine</b> completed{" "}
                      <span className="font-semibold text-obsidian">“Acoustic panels”</span>
                    </>
                  ),
                  time: "Today · 09:12",
                },
                {
                  icon: <MessageSquare size={14} strokeWidth={2.2} className="text-electric" aria-hidden="true" />,
                  body: (
                    <>
                      <b className="font-bold text-obsidian">Marouane</b> commented: “Supplier
                      confirmed Friday delivery for the wifi mesh.”
                    </>
                  ),
                  time: "Yesterday · 17:40",
                },
                {
                  icon: <Flag size={14} strokeWidth={2.2} className="text-warning" aria-hidden="true" />,
                  body: (
                    <>
                      <b className="font-bold text-obsidian">Karim</b> moved the target date by two
                      weeks
                    </>
                  ),
                  time: "Yesterday · 11:05",
                },
                {
                  icon: <PlusCircle size={14} strokeWidth={2.2} className="text-muted" aria-hidden="true" />,
                  body: (
                    <>
                      <b className="font-bold text-obsidian">Demo Admin</b> created this plan
                    </>
                  ),
                  time: plan.start_date ? `${formatShortDate(plan.start_date)} · 10:00` : "Earlier · 10:00",
                },
              ].map((entry, i) => (
                <li key={i} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[27px] top-0 flex h-6 w-6 items-center justify-center rounded-pill border border-border bg-white shadow-sm"
                  >
                    {entry.icon}
                  </span>
                  <p className="text-[12px] leading-snug text-obsidian-light">{entry.body}</p>
                  <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted tabular-nums">
                    {entry.time}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-divider pt-3 text-[10.5px] font-medium text-muted">
              Demo timeline — live activity lands with the backend (task events stream).
            </p>
          </section>

          {/* Plan facts */}
          <section className="card p-5" aria-labelledby="facts-heading">
            <h2
              id="facts-heading"
              className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted"
            >
              Plan details
            </h2>
            <dl className="mt-3 grid grid-cols-[88px_1fr] gap-y-2.5 text-[12px]">
              <dt className="font-semibold text-muted">Owner</dt>
              <dd className="font-semibold text-obsidian">{owner.name}</dd>
              <dt className="font-semibold text-muted">Priority</dt>
              <dd className="font-semibold text-obsidian">
                {plan.priority.charAt(0).toUpperCase() + plan.priority.slice(1)}
              </dd>
              <dt className="font-semibold text-muted">Start</dt>
              <dd className="font-mono font-semibold text-obsidian tabular-nums">
                {plan.start_date ? formatFullDate(plan.start_date) : "—"}
              </dd>
              <dt className="font-semibold text-muted">Target</dt>
              <dd className="font-mono font-semibold text-obsidian tabular-nums">
                {plan.target_date ? formatFullDate(plan.target_date) : "—"}
              </dd>
              <dt className="font-semibold text-muted">Calendar</dt>
              <dd className="font-semibold text-obsidian">
                {plan.target_date_marker ? "Target-date marker shown" : "Hidden"}
              </dd>
            </dl>
            <Link
              href="/plans"
              className="mt-4 inline-flex items-center gap-1 border-t border-divider pt-3 text-[12px] font-bold text-electric transition-colors hover:text-electric-hover"
            >
              View all plans
              <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
