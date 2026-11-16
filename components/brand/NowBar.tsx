/**
 * The Now-Bar: official CALENDAR. brand mark (brand book, §The Mark).
 * Clear space rule: maintain a margin equal to the width of the blue pill
 * (the rect below) on every side. Minimum size: 24px (mark), 120px (lockup).
 *
 * Variants:
 * - obsidian: Obsidian C on light surfaces (default)
 * - white:    White C on dark/obsidian surfaces
 * - mono:     currentColor (single-color contexts: print, email)
 */
export function NowBarMark({
  size = 40,
  variant = "obsidian",
  className = "",
  title = "CALENDAR.",
}: {
  size?: number;
  variant?: "obsidian" | "white" | "mono";
  className?: string;
  title?: string;
}) {
  const stroke =
    variant === "obsidian" ? "#1D1D1F" : variant === "white" ? "#FFFFFF" : "currentColor";
  const pill = variant === "mono" ? "currentColor" : "#0066CC";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <path
        d="M 124 32 L 80 32 C 53.4903 32 32 53.4903 32 80 C 32 106.51 53.4903 128 80 128 L 124 128"
        stroke={stroke}
        strokeWidth={32}
        strokeLinecap="butt"
      />
      <rect x={96} y={52} width={24} height={56} rx={12} fill={pill} />
    </svg>
  );
}

/** Wordmark: “CALENDAR” at 800 weight, −0.04em tracking, Electric Blue period. */
export function Wordmark({
  variant = "obsidian",
  className = "",
}: {
  variant?: "obsidian" | "white";
  className?: string;
}) {
  return (
    <span
      className={`select-none font-extrabold leading-none tracking-[-0.04em] ${
        variant === "obsidian" ? "text-obsidian" : "text-white"
      } ${className}`}
    >
      CALENDAR<span className="text-electric">.</span>
    </span>
  );
}

/** Full lockup: mark + wordmark. */
export function Logo({
  markSize = 40,
  className = "",
  variant = "obsidian",
}: {
  markSize?: number;
  className?: string;
  variant?: "obsidian" | "white";
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <NowBarMark size={markSize} variant={variant} />
      <Wordmark variant={variant} className="text-[22px]" />
    </span>
  );
}
