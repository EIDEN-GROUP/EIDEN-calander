/**
 * imap.ts: IMAP mailbox access for the app (SERVER-ONLY).
 *
 * Hard guarantees:
 *  - Only the MAILBOX_ALLOWED mailbox is ever opened. The mailbox is NOT a
 *    parameter anywhere; IMAP_USER is fixed by env.
 *  - Boot-time guard: if IMAP_USER / MAILBOX_ALLOWED are missing the module
 *    marks itself unconfigured (no throw: demo/preview mode). If both are set
 *    and differ (case-insensitive) the module throws at import time
 *    (fail fast: prevents ever touching the wrong mailbox).
 *  - One connection per Mailbox instance; callers MUST `close()` in a finally.
 *  - No IMAP write is performed except the `\Seen` flag (messageFlagsAdd/Remove)
 *    and, for replies, an optional APPEND to Sent (best effort, caller's choice).
 *    No delete, no move, no expunge.
 *  - Protocol errors are logged with UIDs only, never bodies or secrets.
 *  - Error payloads surfaced to routes use `classifyMailError`: human messages,
 *    no stack traces, no credentials.
 */
import "server-only";
import {
  AuthenticationFailure,
  ImapFlow,
  type FetchMessageObject,
  type ListResponse,
  type MessageStructureObject,
} from "imapflow";
import { sanitizeMessageHtml } from "./sanitize";
import {
  decodeTextPart,
  excerpt,
  normalizeAddressList,
  safeFilename,
  stripControlChars,
  stripHeaderChars,
  MAX_QUOTE_CHARS,
} from "./mime";

/* Boot-time guard */

const IMAP_HOST = (process.env.IMAP_HOST ?? "imap.hostinger.com").trim();
const IMAP_PORT = Number(process.env.IMAP_PORT ?? "993");
const IMAP_USER = process.env.IMAP_USER?.trim();
const IMAP_PASSWORD = process.env.IMAP_PASSWORD;
const MAILBOX_ALLOWED = process.env.MAILBOX_ALLOWED?.trim();

let bootUnconfigured = false;
if (!IMAP_USER || !MAILBOX_ALLOWED) {
  // Not an error: the app runs in demo/preview mode without a mailbox.
  bootUnconfigured = true;
} else if (IMAP_USER.toLowerCase() !== MAILBOX_ALLOWED.toLowerCase()) {
  // Fail fast at import time. Continuing would risk opening the wrong mailbox.
  throw new Error(
    "MAILBOX_ALLOWED mismatch: IMAP_USER does not equal MAILBOX_ALLOWED: refusing to open any mailbox. Fix your environment.",
  );
}

/** True when all env required to open IMAP is present and consistent. */
export function isMailConfigured(): boolean {
  if (bootUnconfigured) return false;
  if (!IMAP_USER || !MAILBOX_ALLOWED) return false;
  if (!IMAP_PASSWORD) return false;
  if (!IMAP_HOST) return false;
  if (!Number.isFinite(IMAP_PORT) || IMAP_PORT <= 0) return false;
  return true;
}

/* Types */

export type MailFolder = "INBOX" | "Sent";
export type MailErrorCode = "IMAP_UNAVAILABLE" | "IMAP_AUTH" | "IMAP_UNKNOWN";

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailMessageSummary {
  uid: number;
  seq: number;
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  /** ISO-8601 string */
  date: string;
  seen: boolean;
  hasAttachments: boolean;
  /** RFC822 size in bytes */
  size: number;
  /** First ~120 chars of the plain text, whitespace-collapsed */
  preview: string;
}

export interface MailAttachmentMeta {
  /** Bodystructure part identifier, e.g. "2" or "1.3" */
  part: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface MailMessage extends MailMessageSummary {
  /** Sanitized HTML, or null when the message has no text/html part */
  html: string | null;
  /** Plain-text body (text/plain, or de-tagged HTML), control chars stripped */
  text: string;
  /** Message-ID header, bracket-stripped; null when absent */
  messageId: string | null;
  inReplyTo: string | null;
  /** References header ids, bracket-stripped */
  references: string[];
  attachments: MailAttachmentMeta[];
  /** Plain-text excerpt for quoting in replies (<= MAX_QUOTE_CHARS) */
  textPlainExcerpt: string;
}

/* Error classification: routes turn these into 502 payloads */

export interface MailErrorInfo {
  code: MailErrorCode;
  /** Human, safe-to-show message. Never contains credentials or bodies. */
  message: string;
}

const UNAVAILABLE_CODES = new Set([
  "CONNECT_TIMEOUT", "GREETING_TIMEOUT", "UPGRADE_TIMEOUT", "ETIMEOUT", "LockTimeout",
  "ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "EPIPE", "EHOSTUNREACH", "ENETUNREACH",
  "NoConnection", "EConnectionClosed", "closed", "ClosedAfterConnectText", "ClosedAfterConnectTLS",
  "StateLogout", "UnexpectedTag", "ResponseTooLarge", "ETHROTTLE",
]);

export function classifyMailError(err: unknown): MailErrorInfo {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  if (err instanceof AuthenticationFailure || code === "AUTHENTICATIONFAILED") {
    return { code: "IMAP_AUTH", message: "Mailbox rejected the login: check the IMAP settings." };
  }
  if (UNAVAILABLE_CODES.has(code)) {
    return { code: "IMAP_UNAVAILABLE", message: "Could not reach the mailbox: check host, port and network." };
  }
  return { code: "IMAP_UNKNOWN", message: "Unexpected mailbox error: see server logs." };
}

/* Bodystructure walking */

interface WalkedPart {
  part: string;
  type: string;
  parameters?: Record<string, string> | undefined;
  disposition?: string | undefined;
  dispositionParameters?: Record<string, string> | undefined;
  encoding?: string | undefined;
  size?: number | undefined;
  childNodes?: WalkedPart[] | undefined;
}

function walkStructure(node: MessageStructureObject | undefined): WalkedPart[] {
  const out: WalkedPart[] = [];
  const visit = (n: MessageStructureObject) => {
    if (Array.isArray(n.childNodes) && n.childNodes.length > 0) {
      for (const child of n.childNodes) visit(child);
      return;
    }
    if (!n.part) return;
    out.push({
      part: n.part,
      type: (n.type ?? "application/octet-stream").toLowerCase(),
      parameters: n.parameters,
      disposition: n.disposition?.toLowerCase(),
      dispositionParameters: n.dispositionParameters,
      encoding: n.encoding?.toLowerCase(),
      size: n.size,
      childNodes: undefined,
    });
  };
  if (node) visit(node);
  return out;
}

function isAttachmentPart(p: WalkedPart): boolean {
  const filename = attachmentFilename(p);
  if (p.disposition === "attachment") return true;
  if (filename && p.type !== "text/plain" && p.type !== "text/html") return true;
  return false;
}

function attachmentFilename(p: WalkedPart): string | null {
  const raw =
    p.dispositionParameters?.["filename"] ??
    p.dispositionParameters?.["filename*"] ??
    p.parameters?.["name"] ??
    p.parameters?.["name*"] ??
    "";
  if (!raw) return null;
  return safeFilename(stripHeaderChars(raw));
}

function toIsoDate(raw: Date | string | undefined, fallback: Date | string | undefined): string {
  const d = raw instanceof Date && !Number.isNaN(raw.getTime()) ? raw : raw ? new Date(raw) : null;
  if (d && !Number.isNaN(d.getTime())) return d.toISOString();
  const f = fallback instanceof Date ? fallback : fallback ? new Date(fallback) : null;
  if (f && !Number.isNaN(f.getTime())) return f.toISOString();
  return new Date(0).toISOString();
}

function seenOf(flags: Set<string> | undefined): boolean {
  if (!flags) return false;
  for (const f of flags) if (f.toLowerCase() === "\\seen") return true;
  return false;
}

/** De-tag an HTML fragment to readable plain text (for previews/fallbacks). */
function htmlToText(html: string): string {
  const noBlocks = html
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, "\n");
  const text = noBlocks.replace(/<[^>]+>/g, " ");
  return stripControlChars(
    text
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'"),
  );
}

/** Parse a References header blob into bracket-stripped message ids. */
export function parseReferencesHeader(raw: Buffer | string | undefined): string[] {
  if (!raw) return [];
  const text = (typeof raw === "string" ? raw : raw.toString("utf8")).replace(/\r?\n[ \t]+/g, " ");
  const ids = text.match(/<[^<>\s]{1,998}>/g) ?? [];
  return ids.map((id) => id.slice(1, -1).trim()).filter(Boolean);
}

function stripBrackets(id: string | undefined | null): string | null {
  if (!id) return null;
  const m = /<([^<>\s]{1,998})>/.exec(id);
  const bare = m ? m[1] : id.trim();
  return bare ? bare.replace(/[\r\n]/g, "") : null;
}

/* The mailbox */

const SENT_FALLBACKS = ["Sent", "Sent Items", "INBOX.Sent"] as const;
const LIST_PREVIEW_BYTES = 384;
const MAX_ATTACHMENTS = 50;
/** Hard cap for in-memory attachment downloads: 25 MB. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export class Mailbox {
  private constructor(private readonly client: ImapFlow) {}
  private sentFolder: string | null = null;

  /**
   * Open the contact@ mailbox. Returns null when unconfigured or unreachable
   * (reason logged server-side without secrets). Callers must `close()`.
   */
  static async create(): Promise<Mailbox | null> {
    if (!isMailConfigured()) {
      console.info("[mail] mailbox unconfigured: running in demo mode");
      return null;
    }
    const client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true, // TLS only (993): no STARTTLS downgrade
      auth: { user: IMAP_USER as string, pass: IMAP_PASSWORD as string },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 30000,
      logger: false,
      tls: { minVersion: "TLSv1.2" },
    });
    try {
      await client.connect();
      return new Mailbox(client);
    } catch (err) {
      const info = classifyMailError(err);
      console.error(`[mail] IMAP connection failed (${info.code})`);
      try {
        client.close();
      } catch {
        // already closed: ignore
      }
      return null;
    }
  }

  /** Graceful logout; falls back to a hard close. Never throws. */
  async close(): Promise<void> {
    try {
      await this.client.logout();
    } catch {
      try {
        this.client.close();
      } catch {
        // socket already gone
      }
    }
  }

  /** Names of all visible folders. */
  async getFolders(): Promise<string[]> {
    const list = await this.client.list({ listOnly: true });
    return list.map((l: ListResponse) => l.path);
  }

  /** Resolve the public folder enum to the real Sent folder name. */
  private async resolveFolder(folder: MailFolder): Promise<string> {
    if (folder === "INBOX") return "INBOX";
    if (this.sentFolder) return this.sentFolder;
    const list = await this.client.list({ listOnly: true });
    const special = list.find((l) => l.specialUse?.toLowerCase() === "\\sent");
    if (special) {
      this.sentFolder = special.path;
      return special.path;
    }
    for (const candidate of SENT_FALLBACKS) {
      const hit = list.find((l) => l.path.toLowerCase() === candidate.toLowerCase());
      if (hit) {
        this.sentFolder = hit.path;
        return hit.path;
      }
    }
    this.sentFolder = "Sent";
    return "Sent";
  }

  private envelopeOf(msg: FetchMessageObject) {
    return msg.envelope ?? {};
  }

  private summaryFrom(msg: FetchMessageObject): MailMessageSummary {
    const env = this.envelopeOf(msg);
    const parts = walkStructure(msg.bodyStructure);
    const hasAttachments = parts.some(isAttachmentPart);
    return {
      uid: msg.uid,
      seq: msg.seq,
      from: normalizeAddressList(env.from)[0] ?? null,
      to: normalizeAddressList(env.to),
      cc: normalizeAddressList(env.cc),
      subject: stripHeaderChars(env.subject ?? "").slice(0, 500) || "(no subject)",
      date: toIsoDate(env.date, msg.internalDate),
      seen: seenOf(msg.flags),
      hasAttachments,
      size: msg.size ?? 0,
      preview: "",
    };
  }

  /**
   * Last `limit` messages by arrival (sequence order ~ date desc for a sane
   * mailbox), enriched with a bounded ~120-char preview fetched via a partial
   * BODY.PEEK[…]<0.384>. Full bodies are never fetched for the list.
   */
  async listMessages(folder: MailFolder, limit = 20): Promise<MailMessageSummary[]> {
    const path = await this.resolveFolder(folder);
    const box = await this.client.mailboxOpen(path, { readOnly: true });
    const total = box.exists;
    if (!total) return [];
    const start = Math.max(1, total - limit + 1);
    const rows = await this.client.fetchAll(`${start}:*`, {
      uid: true,
      flags: true,
      envelope: true,
      internalDate: true,
      size: true,
      bodyStructure: true,
    });
    const previewMeta = new Map<number, TextPartPreview | null>();
    const summaries = rows.map((row) => {
      const summary = this.summaryFrom(row);
      previewMeta.set(row.uid, firstTextPart(walkStructure(row.bodyStructure)));
      return summary;
    });
    summaries.sort((a, b) => b.date.localeCompare(a.date));
    const top = summaries.slice(0, limit);
    await Promise.all(
      top.map(async (summary) => {
        const meta = previewMeta.get(summary.uid);
        if (!meta) return;
        summary.preview = await this.fetchPreview(summary.uid, meta).catch(() => "");
      }),
    );
    return top;
  }

  private async fetchPreview(uid: number, meta: TextPartPreview): Promise<string> {
    const row = await this.client.fetchOne(
      uid,
      { uid: true, bodyParts: [{ key: meta.part, start: 0, maxLength: LIST_PREVIEW_BYTES }] },
      { uid: true },
    );
    const buf = row && typeof row !== "boolean" ? row.bodyParts?.get(meta.part) : undefined;
    if (!buf) return "";
    const text = decodeTextPart(buf, meta.encoding, meta.charset);
    const plain = meta.isHtml ? htmlToText(text) : text;
    return excerpt(plain, 120);
  }

  /** Full fetch of one message (envelope + sanitized body + attachment meta). */
  async fetchMessage(folder: MailFolder, uid: number): Promise<MailMessage | null> {
    const path = await this.resolveFolder(folder);
    await this.client.mailboxOpen(path, { readOnly: true });
    const msg = await this.client.fetchOne(
      uid,
      {
        uid: true,
        flags: true,
        envelope: true,
        internalDate: true,
        size: true,
        bodyStructure: true,
        headers: ["references"],
      },
      { uid: true },
    );
    if (!msg) return null;
    const summary = this.summaryFrom(msg);
    const parts = walkStructure(msg.bodyStructure);
    const textParts = parts.filter((p) => p.type === "text/plain" || p.type === "text/html");
    const fetchKeys = textParts.slice(0, 4).map((p) => p.part);
    let bodyMap: Map<string, Buffer> | undefined;
    if (fetchKeys.length > 0) {
      const withBodies = await this.client.fetchOne(
        uid,
        { uid: true, bodyParts: fetchKeys },
        { uid: true },
      );
      bodyMap = withBodies && typeof withBodies !== "boolean" ? withBodies.bodyParts : undefined;
    }
    const decode = (part: WalkedPart): string => {
      const buf = bodyMap?.get(part.part);
      if (!buf) return "";
      return decodeTextPart(buf, part.encoding, part.parameters?.["charset"]);
    };
    const plainPart = textParts.find((p) => p.type === "text/plain");
    const htmlPart = textParts.find((p) => p.type === "text/html");
    const rawPlain = plainPart ? decode(plainPart) : "";
    const rawHtml = htmlPart ? decode(htmlPart) : "";
    const html = rawHtml ? sanitizeMessageHtml(rawHtml) : null;
    const textSource = rawPlain || (rawHtml ? htmlToText(rawHtml) : "");
    const text = stripControlChars(textSource);
    const env = this.envelopeOf(msg);
    const attachments = parts
      .filter(isAttachmentPart)
      .slice(0, MAX_ATTACHMENTS)
      .map((p) => ({
        part: p.part,
        filename: attachmentFilename(p) ?? "attachment",
        contentType: p.type || "application/octet-stream",
        size: p.size ?? 0,
      }));
    return {
      ...summary,
      html,
      text,
      messageId: stripBrackets(env.messageId),
      inReplyTo: stripBrackets(env.inReplyTo),
      references: parseReferencesHeader(msg.headers),
      attachments,
      textPlainExcerpt: excerpt(text, MAX_QUOTE_CHARS),
    };
  }

  /** Add/remove the \Seen flag: the ONLY write the app performs. */
  async setSeen(folder: MailFolder, uid: number, seen: boolean): Promise<boolean> {
    const path = await this.resolveFolder(folder);
    await this.client.mailboxOpen(path);
    if (seen) return this.client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    return this.client.messageFlagsRemove(uid, ["\\Seen"], { uid: true });
  }

  /**
   * Best-effort search: subject/from CONTAINS q. Returns matching UIDs of the
   * `limit` most recent matches, or null when the server rejected the search
   * (routes then fall back to a client-side filter over the recent list).
   */
  async searchMessages(folder: MailFolder, q: string, limit = 20): Promise<number[] | null> {
    try {
      const path = await this.resolveFolder(folder);
      await this.client.mailboxOpen(path, { readOnly: true });
      const result = await this.client.search(
        { or: [{ subject: q }, { from: q }] },
        { uid: true },
      );
      if (!Array.isArray(result)) return null;
      return result.slice(-limit).reverse();
    } catch (err) {
      const info = classifyMailError(err);
      console.error(`[mail] search failed (${info.code})`);
      return null;
    }
  }

  /**
   * Download one attachment into memory. Enforces the 25 MB cap while
   * streaming. Returns:
   *   - null            → message/part not found, or part is not an attachment
   *   - { tooLarge: true } → exceeds the 25 MB cap (content discarded)
   *   - { tooLarge: false, content, contentType, filename }
   */
  async downloadAttachment(
    folder: MailFolder,
    uid: number,
    part: string,
  ): Promise<
    | null
    | { tooLarge: true }
    | { tooLarge: false; content: Buffer; contentType: string; filename: string }
  > {
    const path = await this.resolveFolder(folder);
    await this.client.mailboxOpen(path, { readOnly: true });
    const msg = await this.client.fetchOne(uid, { uid: true, bodyStructure: true }, { uid: true });
    if (!msg) return null;
    const meta = walkStructure(msg.bodyStructure).find((p) => p.part === part);
    if (!meta || !isAttachmentPart(meta)) return null; // never serve inline parts as downloads
    const dl = await this.client.download(uid, part, {
      uid: true,
      maxBytes: MAX_ATTACHMENT_BYTES + 1,
    });
    if (!dl.content) return null;
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for await (const chunk of dl.content as AsyncIterable<Buffer>) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > MAX_ATTACHMENT_BYTES) {
          try {
            (dl.content as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
          } catch {
            // stream already torn down
          }
          return { tooLarge: true };
        }
        chunks.push(buf);
      }
    } catch {
      return null;
    }
    const rawType = (dl.meta?.contentType ?? meta.type ?? "application/octet-stream")
      .split(";")[0]
      ?.trim()
      .toLowerCase();
    const contentType = rawType && /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(rawType)
      ? rawType
      : "application/octet-stream";
    const filename = safeFilename(
      stripHeaderChars(dl.meta?.filename ?? attachmentFilename(meta) ?? "attachment"),
    );
    return { tooLarge: false, content: Buffer.concat(chunks), contentType, filename };
  }

  /** Best effort: append a raw RFC822 message to the Sent folder. Never throws. */
  async appendToSent(raw: Buffer): Promise<boolean> {
    try {
      const path = await this.resolveFolder("Sent");
      const res = await this.client.append(path, raw, ["\\Seen"]);
      return Boolean(res);
    } catch (err) {
      const info = classifyMailError(err);
      console.error(`[mail] append to Sent failed (${info.code})`);
      return false;
    }
  }
}

/* Preview helpers (listMessages) */

interface TextPartPreview {
  part: string;
  encoding?: string | undefined;
  charset?: string | undefined;
  isHtml: boolean;
}

function firstTextPart(parts: WalkedPart[]): TextPartPreview | null {
  const usable = parts.filter((p) => p.disposition !== "attachment");
  const plain = usable.find((p) => p.type === "text/plain");
  if (plain)
    return { part: plain.part, encoding: plain.encoding, charset: plain.parameters?.["charset"], isHtml: false };
  const html = usable.find((p) => p.type === "text/html");
  if (html)
    return { part: html.part, encoding: html.encoding, charset: html.parameters?.["charset"], isHtml: true };
  return null;
}
