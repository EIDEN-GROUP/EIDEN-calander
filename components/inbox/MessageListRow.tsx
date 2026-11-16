"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { appLocaleTag } from "@/lib/intl-locale";
import { Mail, MailOpen, Paperclip } from "lucide-react";
import type { MailFolder, MailMessageSummary } from "./types";
import { shortListDate, senderName } from "./format";

export function MessageListRow({
  message,
  folder,
  onToggleSeen,
  seenPending,
  selected = false,
  onSelect,
}: {
  message: MailMessageSummary;
  folder: MailFolder;
  onToggleSeen: (uid: number, seen: boolean) => void;
  /** true while a seen-toggle request is in flight for this row */
  seenPending: boolean;
  /** highlighted in the two-pane layout (xl) */
  selected?: boolean;
  /** xl two-pane: select in place instead of navigating */
  onSelect?: (uid: number) => void;
}) {
  const t = useTranslations("inbox");
  const intlLocale = appLocaleTag(useLocale());
  const unread = !message.seen;
  const href = `/inbox/${message.uid}?folder=${encodeURIComponent(folder)}`;
  const fromLabel = senderName(message.from, t("unknownSender"));

  return (
    <li className="group/row relative border-b border-divider last:border-b-0">
      {selected && <span className="now-bar" aria-hidden="true" />}
      <Link
        href={href}
        aria-current={selected || undefined}
        aria-label={t(unread ? "messageUnreadAria" : "messageAria", { from: fromLabel, subject: message.subject })}
        onClick={(event) => {
          // Two-pane on xl: select in place; below xl, navigate as usual.
          if (onSelect && typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches) {
            event.preventDefault();
            onSelect(message.uid);
          }
        }}
        className={`row-lift relative flex gap-3 px-4 py-3 pr-14 outline-none hover:bg-hover-fill/50 focus-visible:bg-electric-tint/40 ${
          selected ? "bg-electric-tint/60" : ""
        }`}
      >
        {/* unread dot */}
        <span className="mt-1.5 flex w-2.5 shrink-0 justify-center" aria-hidden="true">
          {unread && <span className="h-2.5 w-2.5 rounded-pill bg-electric" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span
              title={fromLabel}
              className={`truncate text-[14px] leading-snug ${
                unread ? "font-bold text-obsidian" : "font-medium text-obsidian-light"
              }`}
            >
              {fromLabel}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-muted">
              {message.hasAttachments && (
                <Paperclip size={13} strokeWidth={2} aria-label={t("hasAttachments")} className="text-muted" />
              )}
              {shortListDate(message.date, intlLocale)}
            </span>
          </span>
          <span
            title={message.subject}
            className={`mt-0.5 block truncate text-[13px] leading-snug ${
              unread ? "font-semibold text-obsidian" : "text-obsidian-light"
            }`}
          >
            {message.subject}
          </span>
          <span className="mt-0.5 block truncate text-[12px] leading-snug text-muted" title={message.preview}>
            {message.preview}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleSeen(message.uid, !message.seen);
        }}
        disabled={seenPending}
        aria-pressed={message.seen}
        aria-label={message.seen ? t("markAsUnread") : t("markAsRead")}
        title={message.seen ? t("markAsUnread") : t("markAsRead")}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-pill p-2 text-muted opacity-100 transition-all hover:bg-electric-tint hover:text-electric focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-electric disabled:opacity-50 sm:opacity-0 sm:group-hover/row:opacity-100"
      >
        {message.seen ? <Mail size={17} strokeWidth={2} aria-hidden="true" /> : <MailOpen size={17} strokeWidth={2} aria-hidden="true" />}
      </button>
    </li>
  );
}
