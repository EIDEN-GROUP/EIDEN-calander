"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CornerDownRight, SendHorizontal } from "lucide-react";
import { sendReply } from "./client";
import { mailErrorMessage } from "./error-copy";
import { MailApiError, type MailFolder } from "./types";

export function ReplyBox({
  uid,
  folder,
  demo,
  mailboxAddress,
  onSent,
}: {
  uid: number;
  folder: MailFolder;
  demo: boolean;
  /** The connected mailbox: shown as the "Sending as" identity. */
  mailboxAddress: string;
  onSent: (notice: string) => void;
}) {
  const t = useTranslations("inbox");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = 10_000 - body.length;
  const canSend = body.trim().length > 0 && body.length <= 10_000 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendReply({ uid, folder, body: body.trim(), cc, bcc });
      setBody("");
      setCc("");
      setBcc("");
      setShowCcBcc(false);
      onSent(result.demo ? t("replySentDemo") : t("replySent"));
    } catch (err) {
      setError(
        err instanceof MailApiError
          ? mailErrorMessage(t, err)
          : t("replyRejected"),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      className="border-t border-border bg-surface px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSend();
      }}
    >
      <label htmlFor="reply-body" className="sr-only">
        {t("replyBodyLabel")}
      </label>
      <div className="flex items-start gap-2">
        <CornerDownRight size={16} strokeWidth={2} aria-hidden="true" className="mt-3 shrink-0 text-electric" />
        <textarea
          id="reply-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={10_000}
          autoFocus
          placeholder={t("replyPlaceholder")}
          className="min-h-[104px] w-full resize-y rounded-md border border-border bg-white px-4 py-3 text-[14px] leading-relaxed text-obsidian outline-none transition-shadow placeholder:text-black/50 focus:border-electric/50 focus:shadow-[0_0_0_4px_var(--color-electric-tint)]"
        />
      </div>

      {showCcBcc && (
        <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2">
          <input
            type="text"
            value={cc}
            onChange={(event) => setCc(event.target.value)}
            placeholder={t("ccPlaceholder")}
            aria-label={t("ccAria")}
            className="h-9 rounded-sm border border-border bg-white px-3 text-[12px] outline-none placeholder:text-black/50 focus:border-electric/50"
          />
          <input
            type="text"
            value={bcc}
            onChange={(event) => setBcc(event.target.value)}
            placeholder={t("bccPlaceholder")}
            aria-label={t("bccAria")}
            className="h-9 rounded-sm border border-border bg-white px-3 text-[12px] outline-none placeholder:text-black/50 focus:border-electric/50"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 pl-6 text-[12px] font-semibold text-error-fg">
          <AlertCircle size={13} strokeWidth={2.2} aria-hidden="true" /> {error}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 pl-6">
        <button type="submit" disabled={!canSend} className="btn btn-primary h-10 px-5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50">
          <SendHorizontal size={15} strokeWidth={2} aria-hidden="true" />
          {sending ? t("sending") : t("sendReply")}
        </button>
        <button
          type="button"
          onClick={() => setShowCcBcc((v) => !v)}
          aria-expanded={showCcBcc}
          className="text-[12px] font-semibold text-electric hover:text-electric-hover hover:underline"
        >
          {showCcBcc ? t("hideCcBcc") : t("addCcBcc")}
        </button>
        <span className="text-[11px] tabular-nums text-muted" aria-live="polite">
          {t("charactersLeft", { count: remaining })}
        </span>
        <p className="w-full text-[11px] leading-snug text-muted">
          {t("sendingAs")} <code className="font-mono text-obsidian-light">{mailboxAddress}</code> · {t("threadKeptNote")}
          {demo && <span className="ml-1 font-semibold text-electric">{t("demoNothingSent")}</span>}
        </p>
      </div>
    </form>
  );
}
