"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";

export type ToastItem = { id: number; message: string };

const TOAST_MS = 4000;
const EXIT_MS = 180;

/**
 * Per-page toast queue. Renders a dark pill bottom-right, auto-dismisses after 4s.
 * Pair with <ToastViewport /> and place it near the end of the page root.
 * Enter/exit animated (ease-apple); exit is two-phase per toast.
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [leaving, setLeaving] = useState<ReadonlySet<number>>(new Set());
  const idRef = useRef(0);
  const exitTimers = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setLeaving((current) => (current.has(id) ? current : new Set(current).add(id)));
    if (exitTimers.current.has(id)) return;
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
      setLeaving((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      exitTimers.current.delete(id);
    }, EXIT_MS);
    exitTimers.current.set(id, timer);
  }, []);

  useEffect(
    () => () => {
      exitTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const push = useCallback((message: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev.slice(-1), { id, message }]);
    // Auto-dismiss goes through the two-phase exit path.
    const timer = window.setTimeout(() => {
      exitTimers.current.delete(id);
      dismiss(id);
    }, TOAST_MS);
    exitTimers.current.set(id, timer);
  }, [dismiss]);

  return { toasts, leaving, push, dismiss };
}

export function ToastViewport({
  toasts,
  leaving,
}: {
  toasts: ToastItem[];
  leaving: ReadonlySet<number>;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6"
    >
      {toasts.map((toast) => {
        const isLeaving = leaving.has(toast.id);
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-pill bg-obsidian py-2.5 pl-3 pr-4 text-[13px] font-semibold leading-snug text-white shadow-lg ${
              isLeaving ? "toast-leave" : "toast-in"
            }`}
          >
            <CircleCheck size={15} strokeWidth={2.2} aria-hidden="true" className="shrink-0 text-success" />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
