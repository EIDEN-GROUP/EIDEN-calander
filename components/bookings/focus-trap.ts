"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Focus-trap-lite for dialogs/drawers (brand a11y bar).
 * - Moves focus into the panel on mount (first focusable or the panel itself)
 * - Wraps Tab / Shift+Tab inside the panel
 * - Escape calls `onClose` (unless `enabled` is false — e.g. a child modal is open)
 * - Restores focus to the previously focused element on unmount
 * - Locks body scroll
 *
 * `onClose` is read through a ref, so unstable callback identities from the
 * parent never re-trigger the effect (focus stays where the user put it).
 */
export function useModalA11y(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled = true,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!enabled) return;
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );

    // If something inside the panel already holds focus (e.g. autoFocus on the
    // first field), keep it — otherwise focus the first focusable element.
    const active = document.activeElement as HTMLElement | null;
    if (!active || !panel.contains(active)) {
      const first = focusables()[0];
      if (first) first.focus();
      else {
        panel.setAttribute("tabindex", "-1");
        panel.focus();
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      const idx = items.indexOf(active as HTMLElement);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          items[items.length - 1].focus();
        }
      } else if (idx === items.length - 1 || idx === -1) {
        e.preventDefault();
        items[0].focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [panelRef, enabled]);
}
