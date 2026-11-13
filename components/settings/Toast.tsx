"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";

export type ToastItem = { id: number; message: string };

const TOAST_MS = 4000;

/**
 * Per-page toast queue. Renders a dark pill bottom-right, auto-dismisses after 4s.
 * Pair with <ToastViewport /> and place it near the end of the page root.
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const push = useCallback((message: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev.slice(-1), { id, message }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_MS);
    timers.current.push(timer);
  }, []);

  return { toasts, push };
}

export function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-pill bg-obsidian py-2.5 pl-3 pr-4 text-[13px] font-semibold leading-snug text-white shadow-lg"
        >
          <CircleCheck size={15} strokeWidth={2.2} aria-hidden="true" className="shrink-0 text-success" />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
