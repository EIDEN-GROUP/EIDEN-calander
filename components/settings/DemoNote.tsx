"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

/**
 * Preview-data pill shown on every settings tab.
 * Dismissible for the current page session only (local state, not persisted).
 */
export function DemoNote() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <span className="inline-flex max-w-fit items-center gap-1.5 rounded-pill border border-border bg-canvas py-1 pl-2 pr-1 text-[11px] font-semibold leading-none text-muted">
      <Info size={12} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
      <span className="whitespace-nowrap">Preview data — saves connect to Supabase once .env is set</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss preview data note"
        className="rounded-pill p-1 text-muted transition-colors hover:bg-hover-fill hover:text-obsidian"
      >
        <X size={12} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </span>
  );
}
