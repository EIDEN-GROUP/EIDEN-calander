/** Small client-safe formatting helpers shared by inbox components. */

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dayYearFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fullFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

/** Today → "14:05", this week → "Tue 14:05"? keep simple: same year → "12 Nov", else "12 Nov 2025". */
export function shortListDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return timeFmt.format(d);
  return sameYear ? dayFmt.format(d) : dayYearFmt.format(d);
}

export function fullDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return fullFmt.format(d);
}

/** "812 B" · "4.7 KB" · "1.2 MB" — tabular-nums friendly. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}

/** Initials for the avatar circle: "Nadia Bensaïd" → "NB", "contact@…" → "C". */
export function initialsOf(name: string | null | undefined, address: string | null | undefined): string {
  const src = (name && name.trim()) || address || "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/** Display name for a sender: name if present, else the bare address. */
export function senderName(from: { name: string; address: string } | null): string {
  if (!from) return "Unknown sender";
  return from.name?.trim() ? from.name.trim() : from.address;
}
