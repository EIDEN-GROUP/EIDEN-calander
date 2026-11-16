"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { SHORTCUTS, SHORTCUT_GROUPS, type ShortcutGroup } from "./registry";

/** True on Apple platforms: decides between ⌘ and Ctrl in keycap rendering. */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return true;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
}

const GROUP_LABEL_KEY: Record<ShortcutGroup, "groupGlobal" | "groupGoTo" | "groupActions" | "groupCalendar"> = {
  global: "groupGlobal",
  goTo: "groupGoTo",
  actions: "groupActions",
  calendar: "groupCalendar",
};

/**
 * "?" cheatsheet: every shortcut the app listens to, in one dialog.
 * Focus starts on the close button and cycles inside the panel (Tab trap).
 */
export function ShortcutsCheatsheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("shortcuts");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const mac = isMacPlatform();

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  const renderKeys = (keys: string[]) =>
    keys.map((key, index) => (
      <span key={index} className="inline-flex items-center gap-1">
        {index > 0 && <span className="text-[11px] font-bold text-muted">+</span>}
        <kbd className="kbd">{key === "mod" ? (mac ? "⌘" : "Ctrl") : key}</kbd>
      </span>
    ));

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-6">
      {/* Overlay: click closes */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("closeCheatsheet")}
        onClick={onClose}
        className="overlay-enter absolute inset-0 cursor-default bg-obsidian/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-enter relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md border border-border bg-surface p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-[19px] font-extrabold tracking-[-0.03em] text-obsidian">
              {t("cheatsheetTitle")}
            </h2>
            <p className="mt-0.5 text-[12px] font-medium leading-snug text-obsidian-light">
              {t("cheatsheetSub")}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("closeCheatsheet")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-hover-fill hover:text-obsidian"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {SHORTCUT_GROUPS.map((group) => {
            const entries = SHORTCUTS.filter((entry) => entry.group === group);
            if (entries.length === 0) return null;
            return (
              <section key={group} aria-label={t(GROUP_LABEL_KEY[group])}>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  {t(GROUP_LABEL_KEY[group])}
                </h3>
                <ul className="mt-1.5 divide-y divide-divider overflow-hidden rounded-sm border border-border bg-white">
                  {entries.map((entry) => (
                    <li
                      key={entry.labelKey}
                      className="flex items-center justify-between gap-4 px-3 py-2"
                    >
                      <span className="text-[13px] font-medium text-obsidian">
                        {t(entry.labelKey as "openPalette")}
                      </span>
                      <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                        {renderKeys(entry.keys)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
