"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

/**
 * Spark: tiny headless-ish sparkline (no axes, no grid, Electric stroke,
 * tint fill). Solid electric per brand restraint.
 */
export function Spark({
  data,
  ariaLabel,
  height = 40,
}: {
  data: number[];
  ariaLabel: string;
  height?: number;
}) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <div
      className="w-[96px] shrink-0"
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={series}
          margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
        >
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--color-electric)"
            strokeWidth={2}
            fill="var(--color-electric-tint)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
