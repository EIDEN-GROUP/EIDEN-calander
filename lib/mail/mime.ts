/**
 * mime.ts — small MIME/address/text helpers for the mail layer (SERVER-ONLY).
 * No network, no I/O — pure functions, unit-testable.
 */
import "server-only";
import type { MessageAddressObject } from "imapflow";

export interface NormalizedAddress {
  name: string;
  address: string;
}

/** Remove C0/C1 control characters (keeps \t and \n) from untrusted text. */
export function stripControlChars(input: string): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
}

/** Strip characters that are dangerous in any header context (CR/LF and controls). */
export function stripHeaderChars(input: string): string {
  return stripControlChars(input).replace(/[\r\n]/g, " ").replace(/\s{2,}/g, " ").trim();
}

const EMAIL_RE = /^[^\s@<>"',;:]{1,64}@[^\s@<>"',;:]{1,255}\.[^\s@<>"',;:]{2,}$/;

export function isPlausibleEmail(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length > 320) return false;
  return EMAIL_RE.test(v);
}

/**
 * Validate a comma-separated list of emails (reply cc/bcc).
 * Returns the cleaned list, or null when any entry is invalid.
 */
export function parseEmailList(csv: string | undefined | null): NormalizedAddress[] | null {
  if (csv == null) return [];
  const parts = csv
    .split(",")
    .map((p) => stripHeaderChars(p))
    .filter((p) => p.length > 0);
  if (parts.length > 20) return null; // sane cap — this is an internal tool, not a bulk sender
  if (parts.some((p) => !isPlausibleEmail(p))) return null;
  return parts.map((address) => ({ name: "", address }));
}

/** Normalize an imapflow address array: drop entries without address, clean strings. */
export function normalizeAddressList(list: MessageAddressObject[] | undefined | null): NormalizedAddress[] {
  if (!Array.isArray(list)) return [];
  const out: NormalizedAddress[] = [];
  for (const entry of list) {
    if (!entry || typeof entry.address !== "string") continue;
    const address = stripHeaderChars(entry.address).toLowerCase();
    if (!isPlausibleEmail(address)) continue;
    const name = entry.name ? stripHeaderChars(entry.name).slice(0, 200) : "";
    out.push({ name, address });
  }
  return out;
}

/** "Name <address>" (RFC 5322-ish), or bare address. Never contains CR/LF. */
export function formatAddress(addr: NormalizedAddress | null | undefined): string {
  if (!addr) return "";
  const name = stripHeaderChars(addr.name).replace(/"/g, "'");
  const address = stripHeaderChars(addr.address);
  if (!address) return "";
  return name ? `${name} <${address}>` : address;
}

/** Collapse whitespace, trim, clamp to `max` chars with an ellipsis marker. */
export function excerpt(text: string, max = 120): string {
  if (typeof text !== "string") return "";
  const clean = stripControlChars(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Base-name only + control chars stripped + safe fallback. For Content-Disposition. */
export function safeFilename(name: string | undefined | null): string {
  if (!name) return "attachment";
  // Treat both / and \ as separators regardless of platform, take the last segment.
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = base.replace(/[\x00-\x1F\x7F]/g, "").replace(/[\r\n/\\]/g, "").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return "attachment";
  return cleaned.slice(0, 180);
}

/**
 * Decode a raw transfer-encoded body part to a UTF-8-ish string.
 * Best effort for previews — never throws.
 */
export function decodeTextPart(
  buffer: Buffer,
  transferEncoding: string | undefined,
  charset: string | undefined,
): string {
  try {
    const enc = (transferEncoding ?? "7bit").toLowerCase().trim();
    let bytes: Buffer;
    if (enc === "base64") {
      // Tolerate partial chunks (previews are truncated before full decode).
      const s = buffer.toString("ascii").replace(/[^A-Za-z0-9+/=]/g, "");
      const usable = s.length - (s.length % 4);
      bytes = Buffer.from(s.slice(0, Math.max(usable, 0)), "base64");
    } else if (enc === "quoted-printable") {
      bytes = decodeQuotedPrintable(buffer);
    } else {
      bytes = buffer; // 7bit / 8bit / binary
    }
    const label = (charset ?? "utf-8").toLowerCase().trim() || "utf-8";
    try {
      return new TextDecoder(label as ConstructorParameters<typeof TextDecoder>[0], { fatal: false }).decode(bytes);
    } catch {
      return bytes.toString("utf8");
    }
  } catch {
    return "";
  }
}

/** Decode quoted-printable to raw bytes (handles soft line breaks). */
export function decodeQuotedPrintable(input: Buffer): Buffer {
  const out: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const b = input[i];
    if (b === 0x3d /* = */) {
      const h = input.toString("ascii", i + 1, i + 3);
      if (h === "\r\n" || h[0] === "\n") {
        // Soft line break — skip entirely (=\r\n is 3 bytes).
        i += h === "\r\n" ? 2 : 1;
        continue;
      }
      if (/^[0-9A-Fa-f]{2}$/.test(h)) {
        out.push(parseInt(h, 16));
        i += 2;
        continue;
      }
    }
    if (b !== undefined) out.push(b);
  }
  return Buffer.from(out);
}

const QUOTE_PREFIX = "> ";

/** "On <date>, <from> wrote:" — the attribution line used in quotes. */
export function quoteAttribution(from: string, date?: string | Date | null): string {
  const dateStr =
    date != null
      ? new Date(date).toLocaleString("en-GB", {
          weekday: "short", day: "numeric", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", timeZone: "UTC",
        }) + " UTC"
      : "an earlier date";
  return `On ${dateStr}, ${from} wrote:`;
}

/**
 * Build the plain-text quoted original used in reply bodies.
 * `bodyExcerpt` is the original plain-text excerpt (already capped upstream);
 * this adds the attribution line and the "> " prefix on every line.
 */
export function buildQuoteText(opts: {
  from: string;
  date?: string | Date | null;
  bodyExcerpt: string;
}): string {
  const excerptText = stripControlChars(opts.bodyExcerpt).slice(0, 4000);
  const lines = excerptText.split("\n").map((l) => `${QUOTE_PREFIX}${l}`);
  return `\n\n${quoteAttribution(opts.from, opts.date)}\n${lines.join("\n")}`;
}

export const MAX_QUOTE_CHARS = 4000;
