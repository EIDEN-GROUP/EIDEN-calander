"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Fade+rise on route change (~240ms, ease-apple). Keyed by pathname so the
 * animation replays per navigation; transforms only, content streams underneath.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="view-enter">
      {children}
    </div>
  );
}
