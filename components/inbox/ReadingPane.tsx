"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Mail,
  MailOpen,
  MailWarning,
  Paperclip,
  PenLine,
} from "lucide-react";
import { fetchMessage, setSeenRemote } from "./client";
import { MailErrorBanner } from "./MailErrorBanner";
import { ReplyBox } from "./ReplyBox";
import { formatBytes, fullDateTime } from "./format";
import { MailApiError, type MailFolder, type MailMessage } from "./types";

const EMAIL_BASE_STYLE = `
* { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Helvetica, Arial, sans-serif; color: #424245; box-sizing: border-box; }
body { margin: 10px; font-size: 14px; line-height: 1.55; }
a { color: #0066CC; }
blockquote { border-left: 3px solid #0066CC; margin: 14px 0; padding: 2px 0 2px 14px; }
pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #F5F5F7; border-radius: 6px; font-size: 12px; }
pre { padding: 12px; overflow: auto; }
table { border-collapse: collapse; margin: 10px 0; }
tbody td, thead th, td, th { border: 1px solid rgba(0,0,0,0.12); padding: 6px 10px; }
hr { border: none; border-top: 1px solid rgba(0,0,0,0.12); margin: 16px 0; }
img { max-width: 100%; height: auto; }
`;

/** 1×1 transparent GIF — remote <img> srcs are swapped for this until the user opts in. */
const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

/**
 * Remote images are not fetched at all (display:none would still hit the
 * network). The sanitized markup is well-formed with double-quoted attrs, so a
 * targeted src swap is safe: nothing leaves the mailbox until "Load images".
 */
function blockRemoteImages(html: string): string {
  return html.replace(/(<img\b[^>]*?\bsrc=")(?!data:)[^"]*(")/gi, `$1${BLANK_PIXEL}$2`);
}

export function ReadingPane({
  uid,
  folder,
  inline = false,
  mailboxAddress,
  onSeenChange,
}: {
  uid: number;
  folder: MailFolder;
  /** Rendered inside /inbox's two-pane on xl — hides the page-only chrome. */
  inline?: boolean;
  /** The connected mailbox, threaded down to the reply box. */
  mailboxAddress?: string;
  /** Optimistic sync back to the list pane (seen/unseen toggles). */
  onSeenChange?: (uid: number, seen: boolean) => void;
}) {
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [demo, setDemo] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<MailApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImages, setShowImages] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [seenPending, setSeenPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMessage(uid, folder);
      setMessage(result.message);
      setDemo(result.demo);
      setOffline(result.offline);
    } catch (err) {
      setMessage(null);
      setError(err instanceof MailApiError ? err : new MailApiError(0, "UNKNOWN", "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }, [uid, folder]);

  useEffect(() => {
    // Defer to a task so the fetch + state updates don't run synchronously in the effect.
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const handle = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(handle);
  }, [notice]);

  const toggleSeen = useCallback(async () => {
    if (!message) return;
    const next = !message.seen;
    setSeenPending(true);
    setMessage({ ...message, seen: next });
    onSeenChange?.(message.uid, next);
    try {
      await setSeenRemote(message.uid, folder, next);
    } catch (err) {
      setMessage((current) => (current ? { ...current, seen: !next } : current));
      onSeenChange?.(message.uid, !next);
      setNotice({ text: err instanceof MailApiError ? err.message : "Could not update the read state.", tone: "error" });
    } finally {
      setSeenPending(false);
    }
  }, [message, folder, onSeenChange]);

  // Sandboxed srcDoc. Remote images are swapped for a blank pixel unless the
  // user opts in via "Load images" — nothing is fetched otherwise.
  const htmlBody = message?.html ?? null;
  const srcDoc = useMemo(() => {
    if (!htmlBody) return null;
    const body = showImages ? htmlBody : blockRemoteImages(htmlBody);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${EMAIL_BASE_STYLE}</style></head><body>${body}</body></html>`;
  }, [htmlBody, showImages]);

  const attachmentCount = message?.attachments.length ?? 0;
  const backHref = folder === "Sent" ? "/inbox?folder=Sent" : "/inbox";

  return (
    <div className={`flex flex-col gap-4 ${inline ? "h-full min-h-0" : ""}`}>
      {/* Top bar — back link + demo/notice chips (right-aligned in inline mode) */}
      <div className={`flex items-center gap-3 ${inline ? "justify-end" : "justify-between"}`}>
        {!inline && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-electric outline-none transition-colors hover:text-electric-hover"
          >
            <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
            {folder === "Sent" ? "Sent" : "Inbox"}
          </Link>
        )}
        <div className="flex items-center gap-2">
          {(demo || offline) && (
            <span className="chip border border-electric/20 bg-electric-tint text-[10px] font-bold uppercase tracking-[0.08em] text-electric">
              {offline ? "Offline preview" : "Demo"}
            </span>
          )}
          {notice && (
            <span
              role="status"
              className={`chip border text-[11px] font-semibold ${
                notice.tone === "ok"
                  ? "border-success/30 bg-success-tint text-[#1E6B31]"
                  : "border-error/30 bg-error-tint text-[#B02A1F]"
              }`}
            >
              {notice.tone === "ok" ? (
                <Check size={12} strokeWidth={3} aria-hidden="true" />
              ) : (
                <MailWarning size={12} strokeWidth={2.4} aria-hidden="true" />
              )}
              {notice.text}
            </span>
          )}
        </div>
      </div>

      <section className={`card flex min-h-0 flex-col ${inline ? "flex-1 overflow-y-auto overscroll-contain" : "overflow-hidden"}`}>
        {error && <MailErrorBanner error={error} onRetry={() => void load()} />}

        {/* Header */}
        <header className="border-b border-border px-6 pb-5 pt-6">
          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading message">
              <div className="h-6 w-2/3 animate-pulse rounded-pill bg-track" />
              <div className="h-4 w-1/2 animate-pulse rounded-pill bg-track/70" />
              <div className="h-4 w-1/3 animate-pulse rounded-pill bg-track/50" />
            </div>
          ) : message ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h1 className="max-w-3xl text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-obsidian">
                  {message.subject}
                </h1>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleSeen()}
                    disabled={seenPending}
                    aria-pressed={message.seen}
                    className="btn btn-secondary h-9 px-4 text-[12px] disabled:opacity-50"
                  >
                    {message.seen ? (
                      <>
                        <Mail size={14} strokeWidth={2} aria-hidden="true" /> Mark unread
                      </>
                    ) : (
                      <>
                        <MailOpen size={14} strokeWidth={2} aria-hidden="true" /> Mark read
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyOpen((v) => !v)}
                    aria-expanded={replyOpen}
                    aria-controls="reply-panel"
                    className="btn btn-primary h-9 px-4 text-[12px]"
                  >
                    <PenLine size={14} strokeWidth={2} aria-hidden="true" /> Reply
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid gap-1.5 text-[13px] sm:grid-cols-[auto_1fr] sm:gap-x-4">
                <dt className="font-bold uppercase tracking-[0.08em] text-muted text-[10px] leading-5">From</dt>
                <dd className="min-w-0 text-obsidian">
                  <span className="font-semibold">{message.from?.name || "Unknown sender"}</span>{" "}
                  <code className="font-mono text-[11px] text-muted">&lt;{message.from?.address ?? "—"}&gt;</code>
                </dd>
                <dt className="font-bold uppercase tracking-[0.08em] text-muted text-[10px] leading-5">To</dt>
                <dd className="min-w-0 text-obsidian-light">
                  {message.to.length === 0
                    ? "—"
                    : message.to.map((t) => t.name || t.address).join(", ")}
                  {message.cc.length > 0 && (
                    <span className="text-muted"> · cc {message.cc.map((t) => t.name || t.address).join(", ")}</span>
                  )}
                </dd>
                <dt className="font-bold uppercase tracking-[0.08em] text-muted text-[10px] leading-5">Date</dt>
                <dd className="text-obsidian-light">
                  <time dateTime={message.date} title={message.date}>
                    {fullDateTime(message.date)}
                  </time>
                </dd>
              </dl>

              {attachmentCount > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                    {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {message.attachments.map((att) => (
                      <li key={att.part}>
                        <a
                          href={`/api/mail/attachment?uid=${message.uid}&folder=${encodeURIComponent(folder)}&part=${encodeURIComponent(att.part)}&name=${encodeURIComponent(att.filename)}`}
                          download={att.filename}
                          className="inline-flex max-w-[260px] items-center gap-2 rounded-pill border border-border bg-canvas px-3 py-1.5 text-[12px] font-medium text-obsidian-light transition-colors hover:border-electric/40 hover:text-electric"
                          title={`Download ${att.filename}`}
                        >
                          <Paperclip size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                          <span className="truncate">{att.filename}</span>
                          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">
                            {formatBytes(att.size)}
                          </span>
                          <Download size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </header>

        {/* Body */}
        <div className="flex-1 px-4 py-4 sm:px-5">
          {loading ? (
            <div className="h-[420px] animate-pulse rounded-md border border-border bg-canvas" />
          ) : !message ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <MailWarning size={34} strokeWidth={1.6} className="text-muted" aria-hidden="true" />
              <p className="mt-3 text-[15px] font-bold text-obsidian">This message could not be loaded</p>
              <p className="mt-1 max-w-sm text-[13px] text-muted">
                It may have been moved or the mailbox may be unreachable — use Retry above.
              </p>
            </div>
          ) : srcDoc ? (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Message body</p>
                <button
                  type="button"
                  onClick={() => setShowImages((v) => !v)}
                  aria-pressed={showImages}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-canvas px-3 py-1.5 text-[11px] font-semibold text-obsidian-light transition-colors hover:text-electric"
                >
                  {showImages ? (
                    <>
                      <EyeOff size={12} strokeWidth={2.2} aria-hidden="true" /> Hide images
                    </>
                  ) : (
                    <>
                      <ImageIcon size={12} strokeWidth={2.2} aria-hidden="true" /> Load images
                    </>
                  )}
                </button>
              </div>
              <iframe
                sandbox="allow-same-origin"
                title="Message body"
                className="min-h-[400px] w-full rounded-md border border-border bg-white"
                srcDoc={srcDoc}
              />
              {!showImages && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                  <Eye size={12} strokeWidth={2} aria-hidden="true" /> Remote images are blocked to protect your mailbox. Load them only for messages you trust.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                Plain-text message
              </p>
              <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-canvas p-4 font-sans text-[13px] leading-relaxed text-obsidian-light">
                {message.text || "(empty message)"}
              </pre>
            </>
          )}
        </div>

        {/* Reply */}
        {message && replyOpen && (
          <div id="reply-panel">
            <ReplyBox
              uid={message.uid}
              folder={folder}
              demo={demo || offline}
              mailboxAddress={mailboxAddress ?? "the connected mailbox"}
              onSent={(text) => {
                setNotice({ text, tone: "ok" });
                setReplyOpen(false);
              }}
            />
          </div>
        )}
      </section>

      {!inline && (
        <p className="text-[11px] text-muted">
          Read-only mailbox · no delete, no forward, no compose — replies only. Attachments are always downloaded, never rendered inline.
        </p>
      )}
    </div>
  );
}
