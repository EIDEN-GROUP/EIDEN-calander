import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PlanPriority, PlanStatus } from "@/lib/types/db";

/**
 * Shared plan chips: status (static chip + editable select variant) and
 * priority (dot / full chip). Brand tints only, no hex.
 * Labels come from the `plans` namespace: use the LABEL_KEY maps with t().
 */

export const PLAN_STATUS_LABEL_KEY: Record<
  PlanStatus,
  "statusPlanning" | "statusActive" | "statusOnHold" | "statusCompleted" | "statusCancelled"
> = {
  planning: "statusPlanning",
  active: "statusActive",
  on_hold: "statusOnHold",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
};

export const PLAN_PRIORITY_LABEL_KEY: Record<
  PlanPriority,
  "priorityHigh" | "priorityMedium" | "priorityLow"
> = {
  high: "priorityHigh",
  medium: "priorityMedium",
  low: "priorityLow",
};

export const PLAN_STATUS_META: Record<
  PlanStatus,
  { chip: string; dot: string }
> = {
  planning: { chip: "bg-tint-blue text-tint-fg-blue", dot: "bg-electric" },
  active: { chip: "bg-tint-green text-tint-fg-green", dot: "bg-success" },
  on_hold: { chip: "bg-warning-tint text-tint-fg-amber", dot: "bg-warning" },
  completed: { chip: "bg-track text-obsidian-light", dot: "bg-success" },
  cancelled: { chip: "bg-error-tint text-error-fg", dot: "bg-error" },
};

export const PLAN_PRIORITY_META: Record<
  PlanPriority,
  { dot: string; chip: string }
> = {
  high: { dot: "bg-error", chip: "bg-error-tint text-error-fg" },
  medium: { dot: "bg-warning", chip: "bg-warning-tint text-tint-fg-amber" },
  low: { dot: "bg-success", chip: "bg-success-tint text-tint-fg-green" },
};

export function PlanStatusChip({ status }: { status: PlanStatus }) {
  const t = useTranslations("plans");
  const meta = PLAN_STATUS_META[status];
  return (
    <span className={`chip ${meta.chip}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-pill ${meta.dot}`} />
      {t(PLAN_STATUS_LABEL_KEY[status])}
    </span>
  );
}

/** Editable status chip: a native <select> dressed as a chip (keyboard + SR friendly). */
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
  const t = useTranslations("plans");
  return (
    <span
      className={`chip relative cursor-pointer gap-1.5 pr-6 ${meta.chip} transition-colors`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-pill ${meta.dot}`} />
      <select
        aria-label={labelledBy ? undefined : t("planStatusAria")}
        aria-labelledby={labelledBy}
        value={status}
        onChange={(e) => onChange(e.target.value as PlanStatus)}
        className="cursor-pointer appearance-none bg-transparent text-[11px] font-semibold outline-none"
      >
        {(Object.keys(PLAN_STATUS_META) as PlanStatus[])
          .filter((s) => s !== "cancelled")
          .map((s) => (
            <option key={s} value={s}>
              {t(PLAN_STATUS_LABEL_KEY[s])}
            </option>
          ))}
      </select>
      <ChevronDown
        size={11}
        strokeWidth={2.4}
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-70"
      />
    </span>
  );
}

export function PriorityDot({ priority }: { priority: PlanPriority }) {
  const t = useTranslations("plans");
  const meta = PLAN_PRIORITY_META[priority];
  const label = t(PLAN_PRIORITY_LABEL_KEY[priority]);
  return (
    <span
      title={t("priorityTitle", { priority: label })}
      className="inline-flex items-center gap-1.5"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-pill ${meta.dot}`}
      />
      <span className="sr-only">{t("priorityTitle", { priority: label })}</span>
    </span>
  );
}

export function PriorityChip({ priority }: { priority: PlanPriority }) {
  const t = useTranslations("plans");
  const meta = PLAN_PRIORITY_META[priority];
  return <span className={`chip ${meta.chip}`}>{t(PLAN_PRIORITY_LABEL_KEY[priority])}</span>;
}
