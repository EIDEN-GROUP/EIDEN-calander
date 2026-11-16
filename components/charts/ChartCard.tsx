"use client";

import { Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * ChartCard — white panel shell for one chart/table panel in reports.
 * Title row (small icon tile + bold title) with a right-aligned export slot.
 */
export function ChartCard({
  title,
  icon: Icon,
  iconTint = "bg-tint-blue text-tint-fg-blue",
  onExport,
  exportDisabled = false,
  caption,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconTint?: string;
  onExport?: () => void;
  exportDisabled?: boolean;
  caption?: string;
  children: ReactNode;
}) {
  const t = useTranslations("reports");
  return (
    <section aria-label={title} className="card flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-bold tracking-[-0.01em] text-obsidian">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${iconTint}`}
            aria-hidden="true"
          >
            <Icon size={16} strokeWidth={2} />
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            aria-label={t("exportChartAria", { title })}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border border-border bg-canvas px-3 text-[11px] font-bold text-obsidian-light transition-colors hover:bg-hover-fill hover:text-obsidian disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={12} strokeWidth={2.4} aria-hidden="true" />
            {t("exportCsv")}
          </button>
        )}
      </div>
      <div className="mt-4 min-w-0 flex-1">{children}</div>
      {caption && (
        <p className="mt-3 border-t border-divider pt-3 text-[11px] font-medium leading-snug text-muted">
          {caption}
        </p>
      )}
    </section>
  );
}
