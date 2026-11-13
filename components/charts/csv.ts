/**
 * Client-side CSV generation + download.
 * TODO(WIRE): replace Blob downloads with a route handler that streams the
 * CSV (server-side, auth-checked, shareable link) once exports land on the
 * backend. Filenames stay stable so automations can rely on them.
 */

export type CsvRow = Array<string | number | null | undefined>;

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: CsvRow[]): string {
  // BOM so Excel opens UTF-8 with correct accents (FR client names).
  return "\uFEFF" + rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");

}

export function downloadCsv(filename: string, rows: CsvRow[]): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
