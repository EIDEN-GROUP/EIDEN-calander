/**
 * Shared formatting helpers — CALENDAR. (charts + plans).
 * All dates use the local timezone; date-only strings ("2026-05-01") are
 * parsed as local midnight to avoid UTC-shift surprises.
 */

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

export function formatMAD(n: number): string {
  return `MAD ${formatMoney(n)}`;
}

/** Parse "YYYY-MM-DD" (or any ISO string) as a *local* Date. */
export function parseLocalDate(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }
  return new Date(iso);
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isOverdueDate(iso: string | null): boolean {
  if (!iso) return false;
  return parseLocalDate(iso) < startOfToday();
}

/** "5 May" — compact, for chips and table cells. */
export function formatShortDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** "5 May 2026" */
export function formatFullDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Tue 5 May" — for chart tooltips. */
export function formatDayLong(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Days ago / in N days for the "Target" column when close to today. */
export function relativeDayLabel(iso: string): string | null {
  const target = parseLocalDate(iso);
  const diff = Math.round((target.getTime() - startOfToday().getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return null;
}

/** Deterministic 0-100 share, guards div-by-zero. */
export function shareOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
