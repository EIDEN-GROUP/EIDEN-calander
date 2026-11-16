"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsCheatsheet } from "./ShortcutsCheatsheet";
import {
  CALENDAR_NAV_EVENT,
  G_CHORDS,
  PALETTE_OPEN_EVENT,
  requestNewBooking,
} from "./registry";

const CHORD_WINDOW_MS = 1200;

/** Focus inside a typing surface: shortcuts must not fire. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

/** A dialog/menu/listbox is open: its owner handles the keyboard. */
function isSurfaceOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]'));
}

/**
 * Global keyboard bindings for the app shell. Listens on window in the
 * bubble phase; bails out before yielding to focused typing surfaces and to
 * any open overlay (which owns its own keys). Mount once in (app)/layout.tsx.
 *
 * Bindings live here; the documented list lives in registry.ts (SHORTCUTS).
 */
export function KeyboardManager() {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  // Timestamp of the last "g" keypress; chords are valid inside the window.
  const chordStartedAt = useRef(0);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const newBooking = useCallback(
    () => requestNewBooking(router, pathnameRef.current),
    [router],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘K / Ctrl+K toggles the palette from anywhere, even while typing.
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && !event.shiftKey && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setCheatsheetOpen(false);
        setPaletteOpen((open) => !open);
        return;
      }
      // Never steal other modifier combos.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Overlays own the keyboard while open (the palette included: it has role="dialog").
      if (isSurfaceOpen()) {
        chordStartedAt.current = 0;
        return;
      }
      if (isEditableTarget(event.target)) return;

      const key = event.key;

      // "g" chord: single-key prefix, resolved on the next keypress.
      const chordAge = Date.now() - chordStartedAt.current;
      if (chordStartedAt.current && chordAge <= CHORD_WINDOW_MS) {
        chordStartedAt.current = 0;
        const destination = G_CHORDS[key.toLowerCase()];
        if (destination) {
          event.preventDefault();
          router.push(destination);
          return;
        }
        // Not a chord: fall through and treat the key as a fresh shortcut.
      } else if (chordStartedAt.current) {
        chordStartedAt.current = 0;
      }

      if (key === "g" || key === "G") {
        chordStartedAt.current = Date.now();
        return;
      }
      if (key === "n" || key === "N") {
        event.preventDefault();
        newBooking();
        return;
      }
      if (key === "?") {
        event.preventDefault();
        setPaletteOpen(false);
        setCheatsheetOpen(true);
        return;
      }
      if ((key === "ArrowLeft" || key === "ArrowRight") && pathnameRef.current.startsWith("/calendar")) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent(CALENDAR_NAV_EVENT, { detail: key === "ArrowLeft" ? -1 : 1 }),
        );
      }
    };

    const onBlur = () => {
      chordStartedAt.current = 0;
    };
    const onPaletteOpen = () => {
      setCheatsheetOpen(false);
      setPaletteOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    window.addEventListener(PALETTE_OPEN_EVENT, onPaletteOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener(PALETTE_OPEN_EVENT, onPaletteOpen);
    };
  }, [router, newBooking]);

  return (
    <>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {cheatsheetOpen && <ShortcutsCheatsheet onClose={() => setCheatsheetOpen(false)} />}
    </>
  );
}
