"use client";

/**
 * ProgressRing — SVG ring, Electric arc on track tint, 600ms ease transition
 * on stroke-dashoffset. role="progressbar" with full aria values.
 */
export function ProgressRing({
  value,
  size = 128,
  stroke = 11,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  /** Accessible name, e.g. "Progress for Open Salle Formation". */
  label: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-electric)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 600ms var(--ease-apple)" }}
        />
      </svg>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute flex flex-col items-center"
      >
        <span className="font-mono text-[24px] font-bold leading-none tracking-[-0.03em] text-obsidian tabular-nums">
          {clamped}
          <span className="text-[13px] text-muted">%</span>
        </span>
      </span>
    </div>
  );
}
