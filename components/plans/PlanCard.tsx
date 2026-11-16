"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, CalendarClock, CheckCircle2, CircleAlert } from "lucide-react";
import type { PlanRow, PlanTaskRow } from "@/lib/types/db";
import { getStaff } from "./demo-staff";
import { AvatarInitials } from "./AvatarInitials";
import {
  PLAN_PRIORITY_LABEL_KEY,
  PLAN_PRIORITY_META,
  PLAN_STATUS_LABEL_KEY,
} from "./chips";
import { formatShortDate, isOverdueDate } from "@/components/charts/format";
import { appLocaleTag } from "@/lib/intl-locale";

/**
 * PlanCard: white board card. Draggable between status columns (HTML5 DnD);
 * keyboard users open /plans/[id] and change status from the header select.
 */
export function PlanCard({
  plan,
  tasks,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  plan: PlanRow;
  tasks: PlanTaskRow[];
  onDragStart: (e: React.DragEvent<HTMLElement>, planId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);
  const t = useTranslations("plans");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? "fr" : appLocaleTag();

  const planTasks = tasks.filter((t) => t.plan_id === plan.id);
  const total = planTasks.length;
  const done = planTasks.filter((t) => t.status === "done").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : plan.progress;

  const owner = getStaff(plan.owner_id, t("unassigned"));
  const overdue =
    plan.status !== "completed" &&
    plan.status !== "cancelled" &&
    isOverdueDate(plan.target_date);

  const open = () => router.push(`/plans/${plan.id}`);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  const priority = PLAN_PRIORITY_META[plan.priority];
  const priorityLabel = t(PLAN_PRIORITY_LABEL_KEY[plan.priority]);
  const statusLabel = t(PLAN_STATUS_LABEL_KEY[plan.status]);

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart(e, plan.id)}
      onDragEnd={onDragEnd}
      onClick={open}
      onKeyDown={onKeyDown}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      role="link"
      tabIndex={0}
      aria-label={t("cardAriaLabel", { title: plan.title, status: statusLabel, progress })}
      aria-roledescription={t("cardRoleDescription")}
      data-plan-id={plan.id}
      className={`card group cursor-pointer select-none p-4 text-left transition-all duration-base hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5 ${
        isDragging ? "opacity-50 ring-2 ring-electric/50" : ""
      } ${pressed ? "cursor-grabbing" : ""}`}
    >
      {/* Row 1: priority + marker */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5"
          title={t("priorityTitle", { priority: priorityLabel })}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-pill ${priority.dot}`}
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            {priorityLabel}
          </span>
        </span>
        {plan.target_date_marker && (
          <span
            title={t("markerTitle")}
            className="inline-flex items-center gap-1 rounded-pill bg-electric-tint px-2 py-0.5 text-[11px] font-bold text-electric"
          >
            <CalendarDays size={11} strokeWidth={2.4} aria-hidden="true" />
            {t("calendarChip")}
          </span>
        )}
      </div>

      {/* Row 2: title */}
      <h3 className="mt-2 text-[14px] font-bold leading-snug tracking-[-0.02em] text-obsidian">
        {plan.title}
      </h3>
      {plan.description && (
        <p title={plan.description} className="mt-0.5 line-clamp-1 text-[12px] font-medium leading-snug text-muted">
          {plan.description}
        </p>
      )}

      {/* Row 3: owner + due chip */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <AvatarInitials id={plan.owner_id} size={22} unassignedLabel={t("unassigned")} />
          <span className="truncate text-[12px] font-semibold text-obsidian-light" title={owner.name}>
            {owner.name}
          </span>
        </span>
        {plan.target_date &&
          (overdue ? (
            <span className="chip shrink-0 gap-1 bg-error-tint font-mono text-[11px] font-bold text-error-fg tabular-nums">
              <CircleAlert size={11} strokeWidth={2.4} aria-hidden="true" />
              {formatShortDate(plan.target_date, dateLocale)} · {t("overdue")}
            </span>
          ) : plan.status === "completed" ? (
            <span className="chip shrink-0 gap-1 bg-success-tint font-mono text-[11px] font-bold text-tint-fg-green tabular-nums">
              <CheckCircle2 size={11} strokeWidth={2.4} aria-hidden="true" />
              {t("done")}
            </span>
          ) : (
            <span className="chip shrink-0 gap-1 border border-border bg-canvas font-mono text-[11px] font-semibold text-obsidian-light tabular-nums">
              <CalendarClock size={11} strokeWidth={2.4} aria-hidden="true" />
              {formatShortDate(plan.target_date, dateLocale)}
            </span>
          ))}
      </div>

      {/* Row 4: progress */}
      <div className="mt-3 flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-pill bg-track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("progressFor", { title: plan.title })}
        >
          <div
            className="h-full rounded-pill bg-electric transition-all duration-slower"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-[11px] font-bold text-obsidian-light tabular-nums">
          {progress}%
        </span>
      </div>

      {/* Row 5: tasks count */}
      <div className="mt-2 flex items-center justify-between border-t border-divider pt-2">
        <span className="font-mono text-[11px] font-semibold text-muted tabular-nums">
          {t("tasksCount", { done, total })}
        </span>
        <span className="text-[11px] font-medium text-muted opacity-0 transition-opacity duration-base group-hover:opacity-100">
          {t("openPlan")}
        </span>
      </div>
    </article>
  );
}
