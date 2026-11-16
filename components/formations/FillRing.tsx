/**
 * FillRing — SVG progress ring for formation fill rate.
 * Radius 18 on a 48 viewBox; stroke ramps success → warning (>80%) → error (100%).
 */

import { useTranslations } from "next-intl";

export function FillRing({
  percent,
  size = 56,
  strokeWidth = 5,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const t = useTranslations("formations");
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const offset = circumference * (1 - clamped / 100);
  const color =
    clamped >= 100
      ? "var(--color-error)"
      : clamped > 80
        ? "var(--color-warning)"
        : "var(--color-success)";

  return (
    <span
      role="img"
      aria-label={t("fillRate", { percent: clamped })}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} className="-rotate-90">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s cubic-bezier(0.25, 1, 0.5, 1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold tabular-nums leading-none text-obsidian">
        {clamped}
        <span className="text-[8px] font-bold text-muted">%</span>
      </span>
    </span>
  );
}
