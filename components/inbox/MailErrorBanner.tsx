"use client";

import { AlertTriangle, LogIn, RefreshCw } from "lucide-react";
import type { MailApiError } from "./types";

export function MailErrorBanner({
  error,
  onRetry,
}: {
  error: MailApiError;
  onRetry?: () => void;
}) {
  const auth = error.status === 401;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 border-b border-error/20 bg-error-tint px-4 py-2.5 text-[13px] text-[#B02A1F]"
    >
      <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{auth ? "You are signed out" : "Mailbox unavailable"}</p>
        <p className="mt-0.5 text-[12px] text-[#B02A1F]/90">{error.message}</p>
        <div className="mt-1.5 flex gap-2">
          {auth ? (
            <a href="/login" className="inline-flex items-center gap-1 font-bold underline underline-offset-2 hover:text-[#8F1F16]">
              <LogIn size={12} strokeWidth={2.5} aria-hidden="true" /> Sign in
            </a>
          ) : (
            onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 font-bold underline underline-offset-2 hover:text-[#8F1F16]"
              >
                <RefreshCw size={12} strokeWidth={2.5} aria-hidden="true" /> Retry
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
