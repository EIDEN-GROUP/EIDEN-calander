/**
 * GET /api/mail/messages?folder=INBOX|Sent&q=...
 *
 * Returns the last 20 messages (date desc) — UIDs, envelope data, flags and a
 * bounded ~120-char plain-text preview via partial BODY.PEEK. Full bodies are
 * never fetched here.
 *
 * Search (`q`, max 120 chars): IMAP SEARCH (subject/from CONTAINS) — best
 * effort. When the server rejects the search, falls back to a client-side
 * case-insensitive filter over the 100 most recent summaries and reports
 * `search: { source: "fallback" }`.
 *
 * Demo mode: fixtures with 200 + { demo: true }.
 */
import {
  Mailbox,
  classifyMailError,
  type MailMessageSummary,
} from "@/lib/mail/imap";
import { authorizeMail, jsonError, jsonOk, parseFolder } from "@/lib/mail/http";
import { getDemoMessageList } from "@/lib/mail/demo-messages";

export async function GET(request: Request) {
  const access = await authorizeMail();
  if (!("demo" in access)) return access; // 401

  const url = new URL(request.url);
  const folder = parseFolder(url.searchParams.get("folder"));
  if (!folder) {
    return jsonError(400, "INVALID_FOLDER", "folder must be INBOX or Sent.");
  }
  const qRaw = url.searchParams.get("q");
  const q = qRaw ? qRaw.trim().slice(0, 120) : "";

  if (access.demo) {
    const all = getDemoMessageList(folder);
    const filtered = q ? filterLocally(all, q) : all.slice(0, 20);
    return jsonOk({ demo: true, folder, messages: filtered, ...(q ? { search: { source: "demo", q } } : {}) });
  }

  const mailbox = await Mailbox.create();
  if (!mailbox) {
    return jsonError(502, "IMAP_UNAVAILABLE", "Could not reach the mailbox — check host, port and network.");
  }
  try {
    if (q) {
      const uids = await mailbox.searchMessages(folder, q, 20);
      // Fetch the 100 most recent summaries to resolve UIDs / filter locally.
      const recent = await mailbox.listMessages(folder, 100);
      if (uids) {
        const wanted = new Set(uids);
        const byUid = new Map(recent.map((m) => [m.uid, m]));
        const messages = uids.map((uid) => byUid.get(uid)).filter((m): m is MailMessageSummary => Boolean(m));
        // Rare case: matches older than the last 100 — filter instead of dropping.
        const merged = messages.length > 0 ? messages : recent.filter((m) => wanted.has(m.uid));
        return jsonOk({ demo: false, folder, messages: merged, search: { source: "imap", q } });
      }
      return jsonOk({ demo: false, folder, messages: filterLocally(recent, q).slice(0, 20), search: { source: "fallback", q } });
    }
    const messages = await mailbox.listMessages(folder, 20);
    return jsonOk({ demo: false, folder, messages });
  } catch (err) {
    const info = classifyMailError(err);
    console.error(`[mail] list failed for ${folder} (${info.code})`);
    return jsonError(502, info.code, info.message);
  } finally {
    await mailbox.close();
  }
}

function filterLocally(list: MailMessageSummary[], q: string): MailMessageSummary[] {
  const needle = q.toLowerCase();
  return list.filter(
    (m) =>
      m.subject.toLowerCase().includes(needle) ||
      m.preview.toLowerCase().includes(needle) ||
      (m.from?.address ?? "").toLowerCase().includes(needle) ||
      (m.from?.name ?? "").toLowerCase().includes(needle),
  );
}
