/**
 * client.ts — tiny typed fetch helpers for the inbox UI.
 *
 * Every helper throws MailApiError on non-2xx (with the server's error code),
 * or falls back to the compact offline fixtures when the network/API is
 * completely unreachable (so the preview never white-screens).
 */
import {
  MailApiError,
  type MailFolder,
  type MailMessage,
  type MailMessageSummary,
} from "./types";
import { getFallbackList, getFallbackMessage } from "./fallback-fixtures";

async function mailApiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new MailApiError(0, "NETWORK", "Could not reach the server — check your connection.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON error page (proxy/html) — synthesize a clean error
  }
  const obj = (data ?? {}) as Record<string, unknown> & {
    ok?: boolean;
    error?: { code?: string; message?: string };
  };
  if (!res.ok || obj.ok === false) {
    const code = obj.error?.code ?? `HTTP_${res.status}`;
    const message = obj.error?.message ?? `Request failed (${res.status}).`;
    throw new MailApiError(res.status, code, message);
  }
  return obj as T;
}

export interface ListResult {
  messages: MailMessageSummary[];
  demo: boolean;
  offline: boolean;
  searchSource?: string;
  /** Set when the mail API failed but fixtures were substituted — surfaced as a banner. */
  error?: MailApiError;
}

export async function fetchMessageList(folder: MailFolder, q: string): Promise<ListResult> {
  const params = new URLSearchParams({ folder });
  if (q.trim()) params.set("q", q.trim());
  try {
    const data = await mailApiFetch<{
      messages?: MailMessageSummary[];
      demo?: boolean;
      search?: { source: string };
    }>(`/api/mail/messages?${params.toString()}`);
    return {
      messages: data.messages ?? [],
      demo: Boolean(data.demo),
      offline: false,
      searchSource: data.search?.source,
    };
  } catch (err) {
    if (err instanceof MailApiError && (err.status === 0 || err.status >= 500)) {
      // API/mailbox unreachable → indicator fixtures keep the preview alive,
      // and the error is still surfaced to the UI as a banner.
      return { messages: getFallbackList(folder), demo: true, offline: true, error: err };
    }
    throw err; // 401/400/… surface to the UI as-is
  }
}

export interface MessageResult {
  message: MailMessage;
  demo: boolean;
  offline: boolean;
}

export async function fetchMessage(uid: number, folder: MailFolder): Promise<MessageResult> {
  try {
    const data = await mailApiFetch<{ message?: MailMessage; demo?: boolean }>(
      `/api/mail/message?uid=${uid}&folder=${encodeURIComponent(folder)}`,
    );
    if (!data.message) throw new MailApiError(404, "NOT_FOUND", "Message not found.");
    return { message: data.message, demo: Boolean(data.demo), offline: false };
  } catch (err) {
    if (err instanceof MailApiError && (err.status === 0 || err.status >= 500)) {
      const fallback = getFallbackMessage(uid, folder);
      if (fallback) return { message: fallback, demo: true, offline: true };
    }
    throw err;
  }
}

export async function setSeenRemote(
  uid: number,
  folder: MailFolder,
  seen: boolean,
): Promise<boolean> {
  const data = await mailApiFetch<{ seen?: boolean }>(`/api/mail/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, folder, seen }),
  });
  return Boolean(data.seen);
}

export interface ReplyResult {
  messageId: string | null;
  demo: boolean;
}

export async function sendReply(input: {
  uid: number;
  folder: MailFolder;
  body: string;
  cc?: string;
  bcc?: string;
}): Promise<ReplyResult> {
  const data = await mailApiFetch<{ messageId?: string | null; demo?: boolean }>(`/api/mail/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: input.uid,
      folder: input.folder,
      body: input.body,
      cc: input.cc?.trim() ? input.cc : undefined,
      bcc: input.bcc?.trim() ? input.bcc : undefined,
    }),
  });
  return { messageId: data.messageId ?? null, demo: Boolean(data.demo) };
}
