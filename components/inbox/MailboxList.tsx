"use client";

import { useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { CloudOff, Inbox as InboxIcon, RefreshCw, SearchX, Sparkles } from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";
import { MessageListRow } from "./MessageListRow";
import type { MailFolder, MailMessageSummary } from "./types";

export function MailboxList({
  folder,
  messages,
  loading,
  query,
  onToggleSeen,
  seenPendingIds,
  selectedUid,
  onSelect,
}: {
  folder: MailFolder;
  messages: MailMessageSummary[];
  loading: boolean;
  query: string;
  onToggleSeen: (uid: number, seen: boolean) => void;
  seenPendingIds: Set<number>;
  selectedUid: number | null;
  onSelect: (uid: number) => void;
}) {
  const t = useTranslations("inbox");
  const listRef = useRef<HTMLUListElement>(null);

  const focusSibling = useCallback((from: HTMLElement, delta: number) => {
    const list = listRef.current;
    if (!list) return;
    const links = Array.from(list.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const index = links.indexOf(from as HTMLAnchorElement);
    if (index === -1) return;
    const next = links[Math.min(links.length - 1, Math.max(0, index + delta))];
    next?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusSibling(anchor, 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusSibling(anchor, -1);
      } else if (event.key === "Home") {
        event.preventDefault();
        const first = listRef.current?.querySelector<HTMLAnchorElement>("a[href]");
        first?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        const links = listRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]");
        links?.[links.length - 1]?.focus();
      }
    },
    [focusSibling],
  );

  if (loading && messages.length === 0) {
    return (
      <div className="flex h-full flex-col" role="status" aria-label={t("loadingMessages")} aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex animate-pulse gap-3 border-b border-divider px-4 py-4">
            <div className="mt-1 h-2.5 w-2.5 rounded-pill bg-track" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/5 rounded-pill bg-track" />
              <div className="h-3 w-4/5 rounded-pill bg-track/70" />
              <div className="h-3 w-3/5 rounded-pill bg-track/50" />
            </div>
            <div className="h-3 w-10 rounded-pill bg-track" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    const trimmed = query.trim();
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-14 text-center">
        {trimmed ? (
          <>
            <SearchX size={36} strokeWidth={1.8} className="text-muted" aria-hidden="true" />
            <p className="mt-4 text-[15px] font-bold text-obsidian">{t("noMessagesMatch", { query: trimmed })}</p>
            <p className="mt-1 max-w-[26ch] text-[13px] text-muted">{t("noMessagesHint")}</p>
          </>
        ) : (
          <>
            <NowBarMark size={48} className="opacity-80" />
            <p className="mt-4 text-[15px] font-bold text-obsidian">
              {folder === "INBOX" ? t("inboxZeroTitle") : t("noSentYetTitle")}
            </p>
            <p className="mt-1 max-w-[34ch] text-[13px] text-muted">
              {folder === "INBOX" ? t("inboxZeroBody") : t("noSentYetBody")}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <ul
      ref={listRef}
      onKeyDown={onKeyDown}
      aria-label={folder === "INBOX" ? t("inboxMessages") : t("sentMessages")}
      className="h-full overflow-y-auto overscroll-contain"
    >
      {messages.map((message) => (
        <MessageListRow
          key={`${folder}:${message.uid}`}
          message={message}
          folder={folder}
          onToggleSeen={onToggleSeen}
          seenPending={seenPendingIds.has(message.uid)}
          selected={selectedUid === message.uid}
          onSelect={onSelect}
        />
      ))}
      {loading && (
        <li className="flex items-center justify-center gap-2 py-3 text-[11px] font-semibold text-muted">
          <RefreshCw size={12} className="animate-spin" aria-hidden="true" /> {t("refreshing")}
        </li>
      )}
    </ul>
  );
}

export function MailboxDemoChips({ demo, offline }: { demo: boolean; offline: boolean }) {
  const t = useTranslations("inbox");
  if (offline) {
    return (
      <span className="chip border border-warning/40 bg-warning-tint text-[11px] font-bold uppercase tracking-[0.08em] text-tint-fg-amber">
        <CloudOff size={11} strokeWidth={2.4} aria-hidden="true" /> {t("offlinePreview")}
      </span>
    );
  }
  if (demo) {
    return (
      <span className="chip border border-electric/20 bg-electric-tint text-[11px] font-bold uppercase tracking-[0.08em] text-electric">
        <Sparkles size={11} strokeWidth={2.4} aria-hidden="true" /> {t("demoData")}
      </span>
    );
  }
  return (
    <span className="chip border border-success/25 bg-success-tint text-[11px] font-bold uppercase tracking-[0.08em] text-tint-fg-green">
      <InboxIcon size={11} strokeWidth={2.4} aria-hidden="true" /> {t("liveMailbox")}
    </span>
  );
}
