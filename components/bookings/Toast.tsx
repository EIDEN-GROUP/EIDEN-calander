"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

export type ToastTone = "success" | "warning";
export interface ToastData {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
}

/**
 * Minimal bottom-right dark pill toast.
 * Auto-dismisses after 4s; announced politely to screen readers.
 */
export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData | null;
  onDismiss: () => void;
}) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => onDismissRef.current(), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const Icon = toast.tone === "success" ? CheckCircle2 : TriangleAlert;
  const iconClass =
    toast.tone === "success" ? "text-success" : "text-warning";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 right-4 z-[80] sm:bottom-6 sm:right-6"
    >
      <div
        key={toast.id}
        className="flex max-w-sm items-start gap-2.5 rounded-pill border border-white/10 bg-obsidian py-2.5 pl-4 pr-2 text-white shadow-lg"
      >
        <Icon
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 ${iconClass}`}
        />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-snug">
            {toast.title}
          </span>
          {toast.detail && (
            <span className="mt-0.5 block text-[12px] leading-snug text-white/70">
              {toast.detail}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
