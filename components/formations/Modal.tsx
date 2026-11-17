/**
 * Modal: shared dialog primitive.
 * - role="dialog" + aria-modal + aria-labelledby
 * - Escape closes, backdrop click closes, body scroll locked
 * - First focusable element receives focus; Tab / Shift+Tab cycle inside
 * - Enter/exit animated (~240/320ms, ease-apple) with a two-phase close
 */

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

const SIZE_CLASS: Record<"md" | "lg" | "xl", string> = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

const EXIT_MS = 240;

export function Modal({
  title,
  description,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const t = useTranslations("common");
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  /* Two-phase close: exit animation first, then the parent unmounts us */
  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), EXIT_MS);
  };
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });

  useEffect(() => {
    const panelEl = panelRef.current;
    if (!panelEl) return;
    const panel: HTMLDivElement = panelEl;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => el.offsetParent !== null,
      );

    focusables()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center ${
        closing ? "pointer-events-none" : ""
      }`}
      aria-hidden={closing || undefined}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("closeDialog")}
        onClick={requestClose}
        className={`overlay-enter absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px] transition-opacity duration-slow ease-apple ${
          closing ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-md bg-white p-6 shadow-lg transition-all duration-slow ease-apple sm:m-6 sm:rounded-md ${SIZE_CLASS[size]} ${
          closing ? "translate-y-3 opacity-0 sm:translate-y-2 sm:scale-[0.98]" : "modal-enter"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-[19px] font-extrabold leading-snug tracking-[-0.03em] text-obsidian">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-[13px] leading-snug text-obsidian-light">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label={t("close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-hover-fill hover:text-obsidian"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
