"use client";

import { useCallback, useMemo, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setLiveStaff } from "./demo-staff";
import { createPlanAction, updatePlanStatusAction } from "@/app/actions/plans";
import type { PlansData } from "@/lib/plans-live";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  List,
  PauseCircle,
  Plus,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Toast } from "@/components/bookings/Toast";
import { useDemoToast } from "@/components/charts/useDemoToast";
import { useDemoStore } from "./useDemoStore";
import type { PlanRow, PlanStatus, PlanTaskRow } from "@/lib/types/db";
import {
  PLAN_PRIORITY_META,
  PLAN_STATUS_META,
  PlanStatusChip,
  PriorityDot,
} from "./chips";
import { AvatarInitials } from "./AvatarInitials";
import { PlanCard } from "./PlanCard";
import { NewPlanModal, type NewPlanDraft } from "./NewPlanModal";
import { getStaff } from "./demo-staff";
import { formatFullDate, isOverdueDate } from "@/components/charts/format";

type View = "board" | "list";

const COLUMNS: Array<{
  status: PlanStatus;
  label: string;
  icon: LucideIcon;
  emptyHint: string;
}> = [
  { status: "planning", label: "Planning", icon: ClipboardList, emptyHint: "Nothing in planning — drag a card here or create a plan" },
  { status: "active", label: "Active", icon: Zap, emptyHint: "Nothing active right now" },
  { status: "on_hold", label: "On hold", icon: PauseCircle, emptyHint: "Nothing on hold" },
  { status: "completed", label: "Completed", icon: CheckCircle2, emptyHint: "Nothing completed yet — finish something today" },
];

export function PlansBoard({ data }: { data?: PlansData | null }) {
  const router = useRouter();
  const live = data?.live === true;
  const liveMembers = (data?.members ?? []).map((m) => ({ id: m.id, name: m.full_name.split(" ")[0] ?? m.full_name }));
  const { toast, showToast, dismiss } = useDemoToast();

  useEffect(() => {
    if (data?.members?.length) setLiveStaff(data.members);
  }, [data]);

  const { plans: demoPlans, tasks: demoTasks, commitPlans } = useDemoStore();
  const plans = data?.plans ?? demoPlans;
  const tasks = data?.tasks ?? demoTasks;
  const [view, setView] = useState<View>("board");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<PlanStatus | null>(null);

  const tasksByPlan = useMemo(() => {
    const map = new Map<string, PlanTaskRow[]>();
    for (const t of tasks) {
      const list = map.get(t.plan_id);
      if (list) list.push(t);
      else map.set(t.plan_id, [t]);
    }
    return map;
  }, [tasks]);

  const planProgress = useCallback(
    (plan: PlanRow) => {
      const list = tasksByPlan.get(plan.id) ?? [];
      if (list.length === 0) return plan.progress;
      const done = list.filter((t) => t.status === "done").length;
      return Math.round((done / list.length) * 100);
    },
    [tasksByPlan],
  );

  const movePlanTo = useCallback(
    (planId: string, status: PlanStatus) => {
      if (live) {
        void updatePlanStatusAction({ planId, status }).then((res) => {
          if (!res.ok) showToast(res.error.message, undefined, "warning");
          router.refresh();
        });
        return;
      }
      commitPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? { ...p, status, progress: status === "completed" ? 100 : p.progress }
            : p,
        ),
      );
    },
    [commitPlans, live, router, showToast],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, status: PlanStatus) => {
      e.preventDefault();
      const planId = e.dataTransfer.getData("text/plan-id") || draggedId;
      if (planId) {
        movePlanTo(planId, status);
        showToast(`Moved to ${PLAN_STATUS_META[status].label}`, undefined, "success");
      }
      setDraggedId(null);
      setDropColumn(null);
    },
    [draggedId, movePlanTo, showToast],
  );

  const createPlan = useCallback(
    (draft: NewPlanDraft) => {
      if (live) {
        void createPlanAction({
          title: draft.title,
          description: draft.description || null,
          ownerId: draft.owner_id,
          status: draft.status,
          priority: draft.priority,
          startDate: draft.start_date || null,
          targetDate: draft.target_date || null,
          showOnCalendar: draft.target_date_marker,
        }).then((res) => {
          if (!res.ok) showToast(res.error.message, undefined, "warning");
          else showToast("Plan created", draft.title, "success");
          setModalOpen(false);
          router.refresh();
        });
        return;
      }
      const plan: PlanRow = {
        id: `plan-${Date.now().toString(36)}`,
        title: draft.title,
        description: draft.description || null,
        owner_id: draft.owner_id,
        status: draft.status,
        priority: draft.priority,
        start_date: draft.start_date,
        target_date: draft.target_date,
        progress: 0,
        target_date_marker: draft.target_date_marker,
      };
      commitPlans((prev) => [plan, ...prev]);
      setModalOpen(false);
      showToast("Plan created", plan.title, "success");
    },
    [commitPlans, showToast, live, router],
  );

  const isPlanOverdue = useCallback(
    (p: PlanRow) =>
      p.status !== "completed" && p.status !== "cancelled" && isOverdueDate(p.target_date),
    [],
  );

  const listPlans = useMemo(
    () => (overdueOnly ? plans.filter(isPlanOverdue) : plans),
    [plans, overdueOnly, isPlanOverdue],
  );

  const openPlan = (id: string) => router.push(`/plans/${id}`);
  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      openPlan(id);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.04em] text-obsidian sm:text-[32px]">
            Plans
          </h1>
          <p className="mt-1 max-w-xl text-[14px] font-medium text-obsidian-light">
            Strategic objectives, tracked like work — no meetings about meetings
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="segmented"
            role="group"
            aria-label="View: board or list"
          >
            <button
              type="button"
              className={`segment ${view === "board" ? "segment-active" : ""}`}
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
            >
              <LayoutGrid size={14} strokeWidth={2.2} aria-hidden="true" className="mr-1.5" />
              Board
            </button>
            <button
              type="button"
              className={`segment ${view === "list" ? "segment-active" : ""}`}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={14} strokeWidth={2.2} aria-hidden="true" className="mr-1.5" />
              List
            </button>
          </div>
          <button type="button" className="btn btn-primary h-11" onClick={() => setModalOpen(true)}>
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            New plan
          </button>
        </div>
      </div>

      {/* ============ BOARD ============ */}
      {view === "board" && (
        <div className="mt-5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const colPlans = plans.filter((p) => p.status === col.status);
            const Icon = col.icon;
            const isDropTarget = dropColumn === col.status;
            return (
              <section
                key={col.status}
                aria-label={`${col.label} plans, ${colPlans.length}`}
                className="min-w-0"
              >
                {/* Column header */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-obsidian-light">
                    <span aria-hidden="true" className={`h-2 w-2 rounded-pill ${PLAN_STATUS_META[col.status].dot}`} />
                    {col.label}
                  </h2>
                  <span className="rounded-pill bg-track px-2 py-0.5 font-mono text-[11px] font-bold text-obsidian-light tabular-nums">
                    {colPlans.length}
                  </span>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dropColumn !== col.status) setDropColumn(col.status);
                  }}
                  onDragLeave={() => setDropColumn((c) => (c === col.status ? null : c))}
                  onDrop={(e) => handleDrop(e, col.status)}
                  className={`mt-2 flex min-h-[280px] flex-col gap-2.5 rounded-md border-2 border-dashed p-2 transition-colors duration-150 ${
                    isDropTarget
                      ? "border-electric/50 bg-electric-tint/40"
                      : "border-transparent bg-canvas/70"
                  }`}
                >
                  {colPlans.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-white/60 px-4 py-10 text-center">
                      <Icon size={22} strokeWidth={1.8} className="text-muted" aria-hidden="true" />
                      <p className="max-w-[200px] text-[11.5px] font-medium leading-snug text-muted">
                        {col.emptyHint}
                      </p>
                    </div>
                  ) : (
                    colPlans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        tasks={tasksByPlan.get(plan.id) ?? []}
                        isDragging={draggedId === plan.id}
                        onDragStart={(e, id) => {
                          e.dataTransfer.setData("text/plan-id", id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedId(id);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDropColumn(null);
                        }}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ============ LIST ============ */}
      {view === "list" && (
        <section className="card mt-5 overflow-hidden" aria-label="Plans list">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-4 py-3 sm:px-5">
            <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] font-semibold text-obsidian-light">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-electric"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              Overdue only
            </label>
            <p className="font-mono text-[11px] font-semibold text-muted tabular-nums">
              {listPlans.length} of {plans.length} plans
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead>
                <tr className="border-b border-divider">
                  {["Plan", "Owner", "Status", "Priority", "Target", "Progress"].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.09em] text-muted"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {listPlans.map((plan) => {
                  const progress = planProgress(plan);
                  const owner = getStaff(plan.owner_id);
                  const overdue = isPlanOverdue(plan);
                  return (
                    <tr
                      key={plan.id}
                      tabIndex={0}
                      aria-label={`Open plan ${plan.title}`}
                      onClick={() => openPlan(plan.id)}
                      onKeyDown={(e) => onRowKeyDown(e, plan.id)}
                      className="cursor-pointer transition-colors hover:bg-canvas/70 focus-visible:bg-electric-tint/40"
                    >
                      <td className="px-5 py-3.5">
                        <span className="block text-[13px] font-bold leading-snug text-obsidian">
                          {plan.title}
                        </span>
                        {plan.target_date_marker && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-electric">
                            <CalendarDays size={10} strokeWidth={2.4} aria-hidden="true" />
                            Marker on calendar
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          <AvatarInitials id={plan.owner_id} size={22} />
                          <span className="whitespace-nowrap text-[12px] font-semibold text-obsidian-light">
                            {owner.name}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <PlanStatusChip status={plan.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-obsidian-light">
                          <PriorityDot priority={plan.priority} />
                          {PLAN_PRIORITY_META[plan.priority].label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {plan.target_date ? (
                          <span
                            className={`whitespace-nowrap font-mono text-[12px] font-semibold tabular-nums ${
                              overdue ? "text-error" : "text-obsidian-light"
                            }`}
                          >
                            {formatFullDate(plan.target_date)}
                            {overdue && <span className="ml-1.5 font-sans text-[10px] font-bold uppercase tracking-wide">Overdue</span>}
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-1.5 w-24 overflow-hidden rounded-pill bg-track"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Progress for ${plan.title}`}
                          >
                            <span
                              className="block h-full rounded-pill bg-electric transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </span>
                          <span className="font-mono text-[11px] font-bold text-obsidian-light tabular-nums">
                            {progress}%
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {listPlans.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-[13px] font-medium text-muted">
                      No plans match “Overdue only”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-divider px-5 py-2.5">
            <p className="flex items-center gap-1 text-[11px] font-medium text-muted">
              Click a row or press Enter to open the plan
              <ChevronRight size={11} strokeWidth={2.4} aria-hidden="true" />
            </p>
          </div>
        </section>
      )}

      {/* New plan modal */}
      {modalOpen && (
        <NewPlanModal onClose={() => setModalOpen(false)} onCreate={createPlan} members={live ? liveMembers : undefined} />
      )}

      {/* Demo toast */}
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
