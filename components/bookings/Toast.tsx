"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

export type ToastTone = "success" | "warning";
export interface ToastData {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
}

const EXIT_MS = 180;

/**
 * Minimal bottom-right dark pill toast.
 * Auto-dismisses after 4s; enter/exit animated (ease-apple). Announced politely.
 * Exit is two-phase: play the out animation, then tell the parent to drop it.
 */
export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData | null;
  onDismiss: () => void;
}) {
  const t = useTranslations("calendar");
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  const [shown, setShown] = useState<ToastData | null>(toast);
  const [leaving, setLeaving] = useState(false);
  const [lastToast, setLastToast] = useState<ToastData | null>(toast);

  // Adjust state during render when the prop changes (React-sanctioned pattern):
  // a new toast swaps in immediately; a dropped toast plays the exit first.
  if (toast !== lastToast) {
    setLastToast(toast);
    if (toast) {
      setShown(toast);
      setLeaving(false);
    } else if (shown) {
      setLeaving(true);
    }
  }

  // Auto-dismiss: 4s visible, then exit.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setLeaving(true), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Play the exit, then hand back to the parent.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
      onDismissRef.current();
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (!shown) return null;

  const Icon = shown.tone === "success" ? CheckCircle2 : TriangleAlert;
  const iconClass =
    shown.tone === "success" ? "text-success" : "text-warning";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 right-4 z-[80] sm:bottom-6 sm:right-6"
    >
      <div
        key={shown.id}
        className={`flex max-w-sm items-start gap-2.5 rounded-pill border border-white/10 bg-obsidian py-2.5 pl-4 pr-2 text-white shadow-lg ${
          leaving ? "toast-leave" : "toast-in"
        }`}
      >
        <Icon
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 ${iconClass}`}
        />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-snug">
            {shown.title}
          </span>
          {shown.detail && (
            <span className="mt-0.5 block text-[12px] leading-snug text-white/70">
              {shown.detail}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label={t("dismissNotification")}
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
