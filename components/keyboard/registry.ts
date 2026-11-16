/**
 * Command palette + keyboard shortcut registry: the single source of truth.
 *
 * `buildCommands` produces the runnable palette entries (pages + actions).
 * `SHORTCUTS` documents every binding the app listens to (cheatsheet modal,
 * palette footer hints). Binding behaviour lives in KeyboardManager; adding
 * or changing a shortcut means touching exactly one place per side.
 */

import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  GraduationCap,
  KanbanSquare,
  Languages,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  Settings,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export const PALETTE_OPEN_EVENT = "app:command-palette:open";
export const NEW_BOOKING_EVENT = "app:new-booking";
export const CALENDAR_NAV_EVENT = "app:calendar-nav";

export function requestOpenCommandPalette() {
  window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT));
}

/**
 * Module-level one-shot signal: set on the source page, consumed by the
 * calendar mount. Lets ⌘N open the drawer via a plain /calendar push:
 * a query-param push renders differently under partial prefetching and
 * trips a dev-only hydration warning in the nav. ?new=1 stays as the
 * bookmarkable deep link.
 */
let pendingNewBooking = false;

export function signalNewBooking() {
  pendingNewBooking = true;
}

export function consumeNewBookingSignal(): boolean {
  const pending = pendingNewBooking;
  pendingNewBooking = false;
  return pending;
}

/** Open the booking drawer right here, or queue it for the calendar mount. */
export function requestNewBooking(router: { push: (href: string) => void }, pathname: string | null) {
  if (pathname === "/calendar") {
    window.dispatchEvent(new CustomEvent(NEW_BOOKING_EVENT));
    return;
  }
  signalNewBooking();
  router.push("/calendar");
}

/** G-then-key chord map (mirrors SHORTCUTS below). */
export const G_CHORDS: Record<string, string> = {
  d: "/dashboard",
  c: "/calendar",
  f: "/formations",
  p: "/plans",
  r: "/reports",
  i: "/inbox",
};

/* Commands (palette entries) */

export type CommandSection = "pages" | "actions";

export interface CommandDef {
  id: string;
  section: CommandSection;
  /** Translation key; resolved with the `shell` ns for pages, `shortcuts` ns for actions. */
  labelKey: string;
  /** Extra fuzzy-match terms (EN + FR synonyms, aliases). */
  keywords: string;
  icon: LucideIcon;
  /** Page command → destination. */
  href?: string;
  /** Action command → discriminator for the runner. */
  action?: "new-booking" | "toggle-locale" | "sign-out";
  /** Chord shown as right-aligned hint, e.g. "G D" or "N". */
  chord?: string[];
}

export const COMMAND_DEFS: CommandDef[] = [
  { id: "page.dashboard", section: "pages", labelKey: "navDashboard", keywords: "home overview accueil tableau bord", icon: LayoutDashboard, href: "/dashboard", chord: ["G", "D"] },
  { id: "page.calendar", section: "pages", labelKey: "navCalendar", keywords: "calendar bookings rooms calendrier réservations salles agenda", icon: CalendarDays, href: "/calendar", chord: ["G", "C"] },
  { id: "page.formations", section: "pages", labelKey: "navFormations", keywords: "training courses workshops formation sessions", icon: GraduationCap, href: "/formations", chord: ["G", "F"] },
  { id: "page.clients", section: "pages", labelKey: "navClients", keywords: "customers people clients contacts", icon: Users, href: "/clients" },
  { id: "page.plans", section: "pages", labelKey: "navPlans", keywords: "kanban board tasks planning plan", icon: KanbanSquare, href: "/plans", chord: ["G", "P"] },
  { id: "page.reports", section: "pages", labelKey: "navReports", keywords: "analytics stats charts rapports analytics", icon: BarChart3, href: "/reports", chord: ["G", "R"] },
  { id: "page.inbox", section: "pages", labelKey: "navInbox", keywords: "mail email inbox boîte réception courrier", icon: Mail, href: "/inbox", chord: ["G", "I"] },
  { id: "page.requests", section: "pages", labelKey: "navRequests", keywords: "change requests demandes approbation", icon: ArrowLeftRight, href: "/requests" },
  { id: "page.settings", section: "pages", labelKey: "navSettings", keywords: "preferences options paramètres réglages", icon: Settings, href: "/settings" },
  { id: "page.profile", section: "pages", labelKey: "yourProfile", keywords: "account me profil compte", icon: UserCircle, href: "/profile" },
  { id: "action.new-booking", section: "actions", labelKey: "actionNewBooking", keywords: "new create booking add reservation nouvelle réservation créer ajouter", icon: Plus, action: "new-booking", chord: ["N"] },
  { id: "action.toggle-locale", section: "actions", labelKey: "actionToggleLocale", keywords: "language french english langue français anglais locale traduire en fr", icon: Languages, action: "toggle-locale" },
  { id: "action.sign-out", section: "actions", labelKey: "actionSignOut", keywords: "logout log out signout se déconnecter quitter", icon: LogOut, action: "sign-out" },
];

export interface Command {
  id: string;
  section: CommandSection;
  label: string;
  icon: LucideIcon;
  chord?: string[];
  href?: string;
  action?: CommandDef["action"];
  /** Text the fuzzy filter runs against (lowercased label + keywords). */
  haystack: string;
}

/** Map defs → runnable commands with localized labels. */
export function buildCommands(
  shellT: (key: "navDashboard" | "navCalendar" | "navFormations" | "navClients" | "navPlans" | "navReports" | "navInbox" | "navRequests" | "navSettings" | "yourProfile") => string,
  t: (key: "actionNewBooking" | "actionToggleLocale" | "actionSignOut") => string,
): Command[] {
  return COMMAND_DEFS.map((def) => {
    const label = def.section === "pages"
      ? shellT(def.labelKey as Parameters<typeof shellT>[0])
      : t(def.labelKey as Parameters<typeof t>[0]);
    return {
      id: def.id,
      section: def.section,
      label,
      icon: def.icon,
      chord: def.chord,
      href: def.href,
      action: def.action,
      haystack: `${label} ${def.keywords} ${def.href ?? ""}`.toLowerCase(),
    };
  });
}

/* Fuzzy match: subsequence with streak + word-start bonuses */

/** Returns a score > 0 when every query char appears in order, else 0. */
export function fuzzyScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const s = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) {
      streak += 1;
      score += 1 + streak * 2;
      const prev = s[i - 1];
      if (i === 0 || prev === " " || prev === "-" || prev === "/" || prev === "_") score += 3;
      qi += 1;
    } else {
      streak = 0;
    }
  }
  if (qi < q.length) return 0;
  return score - s.length * 0.01;
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim();
  if (!q) return commands;
  return commands
    .map((cmd) => ({ cmd, score: fuzzyScore(q, cmd.haystack) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ cmd }) => cmd);
}

/* Documented shortcuts (cheatsheet + palette hints) */

export type ShortcutGroup = "global" | "goTo" | "actions" | "calendar";

export interface ShortcutEntry {
  /** Keycaps as shown; "mod" renders ⌘ on macOS and Ctrl elsewhere. */
  keys: string[];
  labelKey: string;
  group: ShortcutGroup;
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = ["global", "goTo", "actions", "calendar"];

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["mod", "K"], labelKey: "openPalette", group: "global" },
  { keys: ["?"], labelKey: "openCheatsheet", group: "global" },
  { keys: ["Esc"], labelKey: "closeAnything", group: "global" },
  { keys: ["G", "D"], labelKey: "goDashboard", group: "goTo" },
  { keys: ["G", "C"], labelKey: "goCalendar", group: "goTo" },
  { keys: ["G", "F"], labelKey: "goFormations", group: "goTo" },
  { keys: ["G", "P"], labelKey: "goPlans", group: "goTo" },
  { keys: ["G", "R"], labelKey: "goReports", group: "goTo" },
  { keys: ["G", "I"], labelKey: "goInbox", group: "goTo" },
  { keys: ["N"], labelKey: "newBooking", group: "actions" },
  { keys: ["←"], labelKey: "prevPeriod", group: "calendar" },
  { keys: ["→"], labelKey: "nextPeriod", group: "calendar" },
];
