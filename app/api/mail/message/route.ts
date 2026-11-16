/**
 * /api/mail/message
 *
 * GET  ?uid=&folder=   → one message: envelope + SANITIZED html (or plain text)
 *                        + attachment meta + Message-ID/References. Never raw.
 * POST { uid, folder, seen } → set/clear the \Seen flag (the only write).
 *
 * Demo mode: fixtures with 200 + { demo: true }.
 */
import {
  Mailbox,
  classifyMailError,
} from "@/lib/mail/imap";
import { authorizeMail, jsonError, jsonOk, parseFolder, parseUid } from "@/lib/mail/http";
import { getDemoMessage, demoSetSeen } from "@/lib/mail/demo-messages";

export async function GET(request: Request) {
  const access = await authorizeMail();
  if (!("demo" in access)) return access; // 401

  const url = new URL(request.url);
  const uid = parseUid(url.searchParams.get("uid"));
  const folder = parseFolder(url.searchParams.get("folder"));
  if (uid == null) return jsonError(400, "INVALID_UID", "uid must be a positive integer.");
  if (!folder) return jsonError(400, "INVALID_FOLDER", "folder must be INBOX or Sent.");

  if (access.demo) {
    const message = getDemoMessage(uid, folder);
    if (!message) return jsonError(404, "NOT_FOUND", "Message not found.");
    return jsonOk({ demo: true, message });
  }

  const mailbox = await Mailbox.create();
  if (!mailbox) {
    return jsonError(502, "IMAP_UNAVAILABLE", "Could not reach the mailbox: check host, port and network.");
  }
  try {
    const message = await mailbox.fetchMessage(folder, uid);
    if (!message) return jsonError(404, "NOT_FOUND", "Message not found.");
    return jsonOk({ demo: false, message });
  } catch (err) {
    const info = classifyMailError(err);
    console.error(`[mail] fetch failed for uid=${uid} (${info.code})`);
    return jsonError(502, info.code, info.message);
  } finally {
    await mailbox.close();
  }
}

export async function POST(request: Request) {
  const access = await authorizeMail();
  if (!("demo" in access)) return access; // 401

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be JSON.");
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const uid = typeof record.uid === "number" ? parseUid(String(record.uid)) : null;
  const folder = parseFolder(typeof record.folder === "string" ? record.folder : null);
  const seen = record.seen;
  if (uid == null) return jsonError(400, "INVALID_UID", "uid must be a positive integer.");
  if (!folder) return jsonError(400, "INVALID_FOLDER", "folder must be INBOX or Sent.");
  if (typeof seen !== "boolean") return jsonError(400, "INVALID_SEEN", "seen must be a boolean.");

  if (access.demo) {
    demoSetSeen(uid, seen);
    return jsonOk({ demo: true, uid, folder, seen });
  }

  const mailbox = await Mailbox.create();
  if (!mailbox) {
    return jsonError(502, "IMAP_UNAVAILABLE", "Could not reach the mailbox: check host, port and network.");
  }
  try {
    const ok = await mailbox.setSeen(folder, uid, seen);
    if (!ok) {
      return jsonError(502, "IMAP_UNKNOWN", "The mailbox refused the flag change: see server logs.");
    }
    return jsonOk({ demo: false, uid, folder, seen });
  } catch (err) {
    const info = classifyMailError(err);
    console.error(`[mail] setSeen failed for uid=${uid} (${info.code})`);
    return jsonError(502, info.code, info.message);
  } finally {
    await mailbox.close();
  }
}
