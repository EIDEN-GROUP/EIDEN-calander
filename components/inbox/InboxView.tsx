"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox as InboxIcon, Mail, RefreshCw, Search } from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";
import { fetchMessageList, setSeenRemote } from "./client";
import { MailErrorBanner } from "./MailErrorBanner";
import { MailboxDemoChips, MailboxList } from "./MailboxList";
import { ReadingPane } from "./ReadingPane";
import { MailApiError, type MailFolder, type MailMessageSummary } from "./types";

export function InboxView({ initialFolder = "INBOX", mailboxAddress }: { initialFolder?: MailFolder; mailboxAddress: string }) {
  const [folder, setFolder] = useState<MailFolder>(initialFolder);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<MailMessageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MailApiError | null>(null);
  const [demo, setDemo] = useState(false);
  const [offline, setOffline] = useState(false);
  const [searchSource, setSearchSource] = useState<string | null>(null);
  const [seenPending, setSeenPending] = useState<Set<number>>(new Set());
  const [counts, setCounts] = useState<Partial<Record<MailFolder, number>>>({});
  const [unread, setUnread] = useState<Partial<Record<MailFolder, number>>>({});
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (target: MailFolder, q: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMessageList(target, q);
      if (id !== requestId.current) return; // a newer request won
      setMessages(result.messages);
      setDemo(result.demo);
      setOffline(result.offline);
      setSearchSource(result.searchSource ?? null);
      setError(result.error ?? null);
      if (!q.trim()) {
        setCounts((c) => ({ ...c, [target]: result.messages.length }));
        setUnread((u) => ({ ...u, [target]: result.messages.filter((m) => !m.seen).length }));
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setMessages([]);
      setError(err instanceof MailApiError ? err : new MailApiError(0, "UNKNOWN", "Something went wrong."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Initial + folder/query changes (300 ms debounce for search)
  useEffect(() => {
    const handle = window.setTimeout(() => void load(folder, query), query.trim() ? 300 : 0);
    return () => window.clearTimeout(handle);
  }, [folder, query, load]);

  // Background: warm the other folder's counts so the header badge shows a
  // real total and the tab switch feels instant. Read-only, one extra request.
  useEffect(() => {
    const other: MailFolder = initialFolder === "Sent" ? "INBOX" : "Sent";
    let cancelled = false;
    fetchMessageList(other, "")
      .then((result) => {
        if (cancelled) return;
        setCounts((c) => ({ ...c, [other]: result.messages.length }));
        setUnread((u) => ({ ...u, [other]: result.messages.filter((m) => !m.seen).length }));
      })
      .catch(() => {
        // badge stays partial — not worth surfacing an error for the counter
      });
    return () => {
      cancelled = true;
    };
  }, [initialFolder]);

  // Client-side narrowing of whatever the server returned (belt and braces)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.preview.toLowerCase().includes(q) ||
        (m.from?.name ?? "").toLowerCase().includes(q) ||
        (m.from?.address ?? "").toLowerCase().includes(q),
    );
  }, [messages, query]);

  const totalUnread = (unread.INBOX ?? 0) + (unread.Sent ?? 0);

  // Apply an optimistic seen-state flip to both the list and the unread counter.
  const applySeen = useCallback((target: MailFolder, uid: number, seen: boolean) => {
    setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen } : m)));
    setUnread((prev) => {
      const current = prev[target];
      if (current == null) return prev;
      return { ...prev, [target]: Math.max(0, current + (seen ? -1 : 1)) };
    });
  }, []);

  const toggleSeen = useCallback(
    async (uid: number, seen: boolean) => {
      setSeenPending((prev) => new Set(prev).add(uid));
      applySeen(folder, uid, seen); // optimistic
      try {
        await setSeenRemote(uid, folder, seen);
      } catch (err) {
        applySeen(folder, uid, !seen); // roll back
        setError(
          err instanceof MailApiError
            ? err
            : new MailApiError(0, "UNKNOWN", "Could not update the read state — try again."),
        );
      } finally {
        setSeenPending((prev) => {
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
      }
    },
    [folder, applySeen],
  );

  // The inline (xl) reading pane toggled seen — mirror it in the list.
  const handleSeenFromPane = useCallback(
    (uid: number, seen: boolean) => applySeen(folder, uid, seen),
    [folder, applySeen],
  );

  const tabs: Array<{ id: MailFolder; label: string }> = [
    { id: "INBOX", label: counts.INBOX != null ? `Inbox (${counts.INBOX})` : "Inbox" },
    { id: "Sent", label: counts.Sent != null ? `Sent (${counts.Sent})` : "Sent" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* H1 row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.04em] text-obsidian">
          Inbox
        </h1>
        <span
          className="inline-flex items-center gap-2 rounded-pill border border-border bg-white px-3 py-1.5 text-[11px] text-obsidian-light"
          title="The only mailbox connected to CALENDAR."
        >
          <span className="h-1.5 w-1.5 rounded-pill bg-success" aria-hidden="true" />
          <code className="font-mono">{mailboxAddress}</code>
          <span
            className="ml-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-pill bg-electric-tint px-1.5 py-0.5 font-sans text-[10px] font-bold tabular-nums text-electric"
            aria-label={`${totalUnread} unread messages across both folders`}
          >
            {totalUnread}
          </span>
        </span>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <label className="relative block">
            <Search
              size={15}
              strokeWidth={2}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search mail…"
              aria-label="Search mail by sender or subject"
              className="h-10 w-48 rounded-pill border border-border bg-white pl-10 pr-4 text-[13px] text-obsidian outline-none transition-shadow placeholder:text-black/30 focus:border-electric/50 focus:shadow-[0_0_0_4px_var(--color-electric-tint)] sm:w-56"
            />
          </label>
          <button
            type="button"
            onClick={() => void load(folder, query)}
            aria-label="Refresh messages"
            className="btn btn-secondary h-10 px-4 text-[13px]"
          >
            <RefreshCw size={15} strokeWidth={2} aria-hidden="true" className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs + meta row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented" role="tablist" aria-label="Mailbox folders">
          {tabs.map((tab) => {
            const active = folder === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                aria-controls="inbox-list-panel"
                onClick={() => {
                  setFolder(tab.id);
                  setSelectedUid(null);
                }}
                className={`segment ${active ? "segment-active" : ""}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <MailboxDemoChips demo={demo} offline={offline} />
        {query.trim() && searchSource && (
          <span className="text-[11px] font-medium text-muted">
            {searchSource === "imap"
              ? "Server search (IMAP)"
              : searchSource === "demo"
                ? "Demo filter — fixtures"
                : "Filtered locally — server search unavailable"}
          </span>
        )}
        <p className="ms-auto hidden text-[11px] text-muted lg:block">
          <kbd className="rounded border border-border bg-white px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>{" "}
          <kbd className="rounded border border-border bg-white px-1.5 py-0.5 font-mono text-[10px]">↓</kbd> navigate ·{" "}
          <kbd className="rounded border border-border bg-white px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> open
        </p>
      </div>

      {/* Two-pane */}
      <div className="grid gap-4 xl:h-[calc(100dvh-215px)] xl:min-h-[520px] xl:grid-cols-[380px_minmax(0,1fr)]">
        <section
          id="inbox-list-panel"
          role="tabpanel"
          aria-label={folder === "INBOX" ? "Inbox messages" : "Sent messages"}
          className="card flex max-h-[62vh] flex-col overflow-hidden xl:max-h-none"
        >
          {error && <MailErrorBanner error={error} onRetry={() => void load(folder, query)} />}
          <MailboxList
            folder={folder}
            messages={visible}
            loading={loading}
            query={query}
            onToggleSeen={(uid, seen) => void toggleSeen(uid, seen)}
            seenPendingIds={seenPending}
            selectedUid={selectedUid}
            onSelect={setSelectedUid}
          />
        </section>

        {/* Two-pane on xl: inline reading pane (or branded empty state) */}
        <section
          aria-label="Message reading pane"
          className="hidden min-h-0 xl:block"
        >
          {selectedUid != null ? (
            <ReadingPane
              key={`${folder}:${selectedUid}`}
              uid={selectedUid}
              folder={folder}
              inline
              mailboxAddress={mailboxAddress}
              onSeenChange={handleSeenFromPane}
            />
          ) : (
            <div className="card flex h-full flex-col items-center justify-center px-8 py-16 text-center">
              <NowBarMark size={72} className="opacity-90" />
              <p className="mt-6 text-[17px] font-extrabold tracking-[-0.02em] text-obsidian">
                Select a message to read
              </p>
              <p className="mt-1.5 max-w-sm text-[13px] leading-snug text-muted">
                Open any conversation on the left — attachments download via the server, remote images
                stay blocked until you allow them, and replies are sent as{" "}
                <code className="font-mono text-[12px] text-obsidian-light">{mailboxAddress}</code>.
              </p>
              <div className="mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                <InboxIcon size={13} strokeWidth={2} aria-hidden="true" />
                Read-only mailbox · no delete · no forward
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <Mail size={12} strokeWidth={2} aria-hidden="true" />
        Hosted mail, one mailbox only — replies keep the thread in this mailbox. Credentials never leave the server.
      </p>
    </div>
  );
}
