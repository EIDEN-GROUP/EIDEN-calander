/**
 * StatusChip — token-only tinted pill. FormationStatusChip maps a derived
 * formation lifecycle state onto a tone + label.
 */

import type { ReactNode } from "react";
import type { EffectiveFormationStatus } from "./model";

export type ChipTone =
  | "success"
  | "warning"
  | "error"
  | "muted"
  | "electric"
  | "green"
  | "amber"
  | "purple"
  | "blue";

const TONE_CLASSES: Record<ChipTone, string> = {
  success: "bg-success-tint text-tint-fg-green",
  warning: "bg-warning-tint text-tint-fg-amber",
  error: "bg-error-tint text-error",
  muted: "bg-track text-muted",
  electric: "bg-electric-tint text-electric",
  green: "bg-tint-green text-tint-fg-green",
  amber: "bg-tint-amber text-tint-fg-amber",
  purple: "bg-tint-purple text-tint-fg-purple",
  blue: "bg-tint-blue text-tint-fg-blue",
};

export function StatusChip({
  tone,
  dot = false,
  className = "",
  children,
}: {
  tone: ChipTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`chip ${TONE_CLASSES[tone]} ${className}`}>
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function FormationStatusChip({
  status,
  seatsLeft,
}: {
  status: EffectiveFormationStatus;
  seatsLeft?: number;
}) {
  switch (status) {
    case "open":
      return (
        <StatusChip tone="success" dot>
          {seatsLeft ?? 0} seats left
        </StatusChip>
      );
    case "full":
      return (
        <StatusChip tone="error" dot>
          Full — waitlist
        </StatusChip>
      );
    case "ongoing":
      return (
        <StatusChip tone="electric" dot>
          Ongoing
        </StatusChip>
      );
    case "completed":
      return <StatusChip tone="muted">Completed</StatusChip>;
    case "cancelled":
      return <StatusChip tone="error">Cancelled</StatusChip>;
    case "paused":
      return (
        <StatusChip tone="warning" dot>
          Paused
        </StatusChip>
      );
    default:
      return <StatusChip tone="muted">Draft</StatusChip>;
  }
}
