"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Search, CornerDownLeft } from "lucide-react";
import { setLocaleAction } from "@/app/actions/locale";
import { signOutAction } from "@/app/actions/sign-out";
import {
  buildCommands,
  filterCommands,
  requestNewBooking,
  type Command,
} from "./registry";

const LISTBOX_ID = "command-palette-listbox";
const optionId = (index: number) => `command-palette-option-${index}`;

/**
 * ⌘K command palette. Rendered as a portal overlay; mounts on open so focus
 * is captured and restored cleanly. Keyboard-first: ↑/↓ navigate, Enter runs,
 * Tab cycles (focus never leaves the input), Esc closes.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const t = useTranslations("shortcuts");
  const tShell = useTranslations("shell");
  const locale = useLocale() as "en" | "fr";
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const commands = useMemo(() => buildCommands(tShell, t), [tShell, t]);
  const filtered = useMemo(() => filterCommands(commands, query), [commands, query]);

  // Display order: pages first, then actions (stable within each group).
  // The keyboard navigates exactly this order, so ids/index always line up.
  const display = useMemo(
    () => [
      ...filtered.filter((c) => c.section === "pages"),
      ...filtered.filter((c) => c.section === "actions"),
    ],
    [filtered],
  );
  const displayIndex = useMemo(() => {
    const map = new Map<string, number>();
    display.forEach((cmd, index) => map.set(cmd.id, index));
    return map;
  }, [display]);
  const active = display.length === 0 ? -1 : Math.min(activeIndex, display.length - 1);

  /* Focus: capture on mount, restore on unmount */
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, []);

  /* Keep the active option in view */
  useEffect(() => {
    if (active < 0) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(active))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      onClose();
      if (command.href) {
        router.push(command.href);
        return;
      }
      switch (command.action) {
        case "new-booking":
          requestNewBooking(router, pathname);
          return;
        case "toggle-locale":
          void setLocaleAction(locale === "en" ? "fr" : "en").then(() => router.refresh());
          return;
        case "sign-out":
          void signOutAction();
          return;
      }
    },
    [onClose, router, pathname, locale],
  );

  const moveActive = useCallback((delta: 1 | -1) => {
    setActiveIndex((i) => {
      const len = display.length;
      if (len === 0) return 0;
      return (Math.min(i, len - 1) + delta + len) % len;
    });
  }, [display.length]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const key = event.key;
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      moveActive(key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (key === "Tab") {
      // Focus trap: cycle the highlight instead of leaving the palette.
      event.preventDefault();
      moveActive(event.shiftKey ? -1 : 1);
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      run(display[active]);
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const sections = (["pages", "actions"] as const)
    .map((section) => ({
      section,
      items: display.filter((c) => c.section === section),
    }))
    .filter(({ items }) => items.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="presentation">
      {/* Overlay: click closes */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("closePalette")}
        onClick={onClose}
        className="overlay-enter absolute inset-0 cursor-default bg-obsidian/35 backdrop-blur-[2px]"
      />

      {/* Panel: anchored like Spotlight */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("paletteTitle")}
        className="modal-enter absolute left-1/2 top-[8dvh] flex max-h-[84dvh] w-[min(92vw,560px)] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border bg-surface shadow-lg sm:top-[16vh]"
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-divider px-4">
          <Search size={17} strokeWidth={2} aria-hidden="true" className="shrink-0 text-black/35" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("palettePlaceholder")}
            aria-label={t("paletteTitle")}
            aria-autocomplete="list"
            aria-controls={LISTBOX_ID}
            aria-expanded="true"
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            role="combobox"
            className="h-14 w-full border-0 bg-transparent text-[16px] text-obsidian outline-none placeholder:text-black/50"
          />
          <kbd className="kbd shrink-0">esc</kbd>
        </div>

        {/* Results */}
        <ul
          id={LISTBOX_ID}
          ref={listRef}
          role="listbox"
          aria-label={t("paletteTitle")}
          className="min-h-0 flex-1 overflow-y-auto py-2"
        >
          {sections.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] font-medium text-muted">
              {t("paletteNoResults", { query: query.trim() })}
            </li>
          )}
          {sections.map(({ section, items }) => (
            <li key={section} role="group" aria-label={section === "pages" ? t("sectionPages") : t("sectionActions")}>
              <p className="px-4 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                {section === "pages" ? t("sectionPages") : t("sectionActions")}
              </p>
              <ul>
                {items.map((command) => {
                  const index = displayIndex.get(command.id) ?? -1;
                  const isActive = index === active;
                  const Icon = command.icon;
                  return (
                    <li
                      key={command.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => run(command)}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 outline-none transition-colors duration-fast ${
                        isActive ? "bg-electric-tint text-electric" : "text-obsidian"
                      }`}
                    >
                      <Icon
                        size={17}
                        strokeWidth={1.9}
                        aria-hidden="true"
                        className={`shrink-0 ${isActive ? "text-electric" : "text-obsidian-light"}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" title={command.label}>
                        {command.label}
                      </span>
                      {command.chord && (
                        <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                          {command.chord.map((key, i) => (
                            <kbd key={i} className="kbd">
                              {key}
                            </kbd>
                          ))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-divider bg-canvas/60 px-4 py-2 text-[11px] font-semibold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            {t("hintNavigate")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CornerDownLeft size={12} strokeWidth={2.2} aria-hidden="true" className="text-obsidian-light" />
            {t("hintRun")}
          </span>
          <span className="ms-auto hidden items-center gap-1.5 sm:inline-flex">
            <kbd className="kbd">?</kbd>
            {t("hintCheatsheet")}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
