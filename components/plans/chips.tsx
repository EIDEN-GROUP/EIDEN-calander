import { ChevronDown } from "lucide-react";
import type { PlanPriority, PlanStatus } from "@/lib/types/db";

/**
 * Shared plan chips — status (static chip + editable select variant) and
 * priority (dot / full chip). Brand tints only, no hex.
 */

export const PLAN_STATUS_META: Record<
  PlanStatus,
  { label: string; chip: string; dot: string }
> = {
  planning: { label: "Planning", chip: "bg-tint-blue text-tint-fg-blue", dot: "bg-electric" },
  active: { label: "Active", chip: "bg-tint-green text-tint-fg-green", dot: "bg-success" },
  on_hold: { label: "On hold", chip: "bg-warning-tint text-tint-fg-amber", dot: "bg-warning" },
  completed: { label: "Completed", chip: "bg-track text-obsidian-light", dot: "bg-success" },
  cancelled: { label: "Cancelled", chip: "bg-error-tint text-error", dot: "bg-error" },
};

export const PLAN_PRIORITY_META: Record<
  PlanPriority,
  { label: string; dot: string; chip: string }
> = {
  high: { label: "High", dot: "bg-error", chip: "bg-error-tint text-error" },
  medium: { label: "Medium", dot: "bg-warning", chip: "bg-warning-tint text-tint-fg-amber" },
  low: { label: "Low", dot: "bg-success", chip: "bg-success-tint text-tint-fg-green" },
};

export function PlanStatusChip({ status }: { status: PlanStatus }) {
  const meta = PLAN_STATUS_META[status];
  return (
    <span className={`chip ${meta.chip}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-pill ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/** Editable status chip — a native <select> dressed as a chip (keyboard + SR friendly). */
export function PlanStatusSelect({
  status,
  onChange,
  labelledBy,
}: {
  status: PlanStatus;
  onChange: (next: PlanStatus) => void;
  labelledBy?: string;
}) {
  const meta = PLAN_STATUS_META[status];
  return (
    <span
      className={`chip relative cursor-pointer gap-1.5 pr-6 ${meta.chip} transition-colors`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-pill ${meta.dot}`} />
      <select
        aria-label={labelledBy ? undefined : "Plan status"}
        aria-labelledby={labelledBy}
        value={status}
        onChange={(e) => onChange(e.target.value as PlanStatus)}
        className="cursor-pointer appearance-none bg-transparent text-[11px] font-semibold outline-none"
      >
        {(Object.keys(PLAN_STATUS_META) as PlanStatus[])
          .filter((s) => s !== "cancelled")
          .map((s) => (
            <option key={s} value={s}>
              {PLAN_STATUS_META[s].label}
            </option>
          ))}
      </select>
      <ChevronDown
        size={11}
        strokeWidth={2.6}
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-70"
      />
    </span>
  );
}

export function PriorityDot({ priority }: { priority: PlanPriority }) {
  const meta = PLAN_PRIORITY_META[priority];
  return (
    <span
      title={`${meta.label} priority`}
      className="inline-flex items-center gap-1.5"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-pill ${meta.dot}`}
      />
      <span className="sr-only">{meta.label} priority</span>
    </span>
  );
}

export function PriorityChip({ priority }: { priority: PlanPriority }) {
  const meta = PLAN_PRIORITY_META[priority];
  return <span className={`chip ${meta.chip}`}>{meta.label}</span>;
}
