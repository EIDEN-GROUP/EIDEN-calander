"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Spark } from "./Spark";

/**
 * StatTile — boardroom KPI tile: white card, caps label, huge mono number,
 * delta arrow vs previous period (toggleable) + deterministic sparkline.
 */
export function StatTile({
  label,
  value,
  prefix,
  suffix,
  delta,
  trend = "up",
  series,
  comparison,
  icon: Icon,
  tint,
  sparkLabel,
}: {
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  delta: string;
  trend?: "up" | "down";
  /** Deterministic series for the sparkline (12 points). */
  series: number[];
  /** When false the delta row collapses to a muted "Comparison off" note. */
  comparison: boolean;
  icon: LucideIcon;
  tint: string;
  sparkLabel: string;
}) {
  const DeltaIcon = trend === "up" ? ArrowUpRight : ArrowDownRight;
  const deltaTone = trend === "up" ? "text-success" : "text-error";

  return (
    <div className="card flex flex-col justify-between gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-sm ${tint}`}
          aria-hidden="true"
        >
          <Icon size={18} strokeWidth={2} />
        </span>
        <Spark data={series} ariaLabel={sparkLabel} />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <p className="mt-1 font-mono text-[26px] font-bold leading-none tracking-[-0.02em] text-obsidian tabular-nums sm:text-[28px]">
          {prefix && (
            <span className="mr-1 align-baseline text-[13px] font-bold text-muted">
              {prefix}
            </span>
          )}
          {value}
          {suffix && (
            <span className="ml-0.5 align-baseline text-[15px] font-bold text-obsidian-light">
              {suffix}
            </span>
          )}
        </p>
        <div className="mt-1.5 flex h-[18px] items-center">
          {comparison ? (
            <p
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${deltaTone}`}
            >
              <DeltaIcon size={12} strokeWidth={2.6} aria-hidden="true" />
              <span className="font-mono tabular-nums">{delta}</span>
              <span className="ml-1 font-medium text-muted">vs prev. period</span>
            </p>
          ) : (
            <p className="text-[11px] font-medium text-muted">Comparison off</p>
          )}
        </div>
      </div>
    </div>
  );
}
