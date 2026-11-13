"use client";

import { useCallback, useState } from "react";
import type { ToastData, ToastTone } from "@/components/bookings/Toast";

/**
 * Shared demo toast state for plans + reports pages.
 * Pair with <Toast toast={toast} onDismiss={dismiss} /> from components/bookings/Toast.
 */
export function useDemoToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback(
    (title: string, detail?: string, tone: ToastTone = "success") => {
      setToast({ id: Date.now(), title, detail, tone });
    },
    [],
  );
  const dismiss = useCallback(() => setToast(null), []);

  return { toast, showToast, dismiss };
}
