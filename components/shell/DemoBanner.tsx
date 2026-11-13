"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

export function DemoBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div
      role="status"
      className="relative flex items-center justify-center gap-2 border-b border-electric/15 bg-electric-tint px-8 py-2 text-center text-[12px] font-semibold text-electric-hover"
    >
      <Sparkles size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      <span>
        Preview mode — connect Supabase (see <code className="rounded bg-white/60 px-1 font-mono text-[11px]">.env.example</code>) to go live. Screens show demo data.
      </span>
      <button
        onClick={() => setHidden(true)}
        aria-label="Dismiss preview notice"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-pill p-1 text-electric-hover/70 transition-colors hover:text-electric-hover"
      >
        <X size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}
