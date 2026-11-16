/**
 * Toast: lightweight aria-live toast queue.
 * useToast() holds the queue; <ToastViewport /> renders it.
 */

"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [leaving, setLeaving] = useState<ReadonlySet<number>>(new Set());
  const idRef = useRef(0);
  const exitTimers = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setLeaving((current) => (current.has(id) ? current : new Set(current).add(id)));
    if (exitTimers.current.has(id)) return;
    // Play the exit for this toast, then drop it from the queue.
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
      setLeaving((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      exitTimers.current.delete(id);
    }, 180);
    exitTimers.current.set(id, timer);
  }, []);

  useEffect(
    () => () => {
      exitTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    idRef.current += 1;
    const id = idRef.current;
    // Keep at most 3 visible; newest last.
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      // Dismiss the oldest via the exit path, not a hard cut.
      dismiss(toasts[0].id);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [toasts, dismiss]);

  return { toasts, leaving, push, dismiss };
}

const TONE_ICON: Record<ToastTone, typeof Check> = {
  success: Check,
  error: AlertTriangle,
  info: Info,
};

const TONE_ICON_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-error",
  info: "text-white",
};

export function ToastViewport({
  toasts,
  leaving,
  onDismiss,
}: {
  toasts: ToastItem[];
  leaving: ReadonlySet<number>;
  onDismiss: (id: number) => void;
}) {
  const t = useTranslations("common");
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-8 print:hidden"
    >
      {toasts.map((toast) => {
        const Icon = TONE_ICON[toast.tone];
        const isLeaving = leaving.has(toast.id);
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-pill bg-obsidian py-2 pl-4 pr-1.5 text-[13px] font-semibold text-white shadow-lg ${
              isLeaving ? "toast-leave" : "toast-in"
            }`}
          >
            <Icon size={17} strokeWidth={2.4} aria-hidden="true" className={`shrink-0 ${TONE_ICON_CLASS[toast.tone]}`} />
            <span className="min-w-0 flex-1 leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label={t("dismissNotification")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
