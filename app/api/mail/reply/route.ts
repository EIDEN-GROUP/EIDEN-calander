/**
 * POST /api/mail/reply
 * Body: { uid: number, folder: "INBOX"|"Sent", body: string (1..10000),
 *         cc?: string (csv of emails), bcc?: string }
 *
 *  - From is FIXED to EMAIL_FROM (never caller-supplied).
 *  - Subject: "Re: <original>" (prefixed only when absent).
 *  - Quoted original body text embedded (first 4000 chars, escaped in HTML).
 *  - In-Reply-To + References set from the original Message-ID.
 *  - Recipients come from the original message (to=From for INBOX, else the
 *    first To: of the Sent original, falling back to From). No spoofing.
 *  - Rate limit: 30 replies / 10 min / user — in-memory, best effort.
 *    TODO(WIRE): enforce at the edge / Upstash before multi-instance deploys.
 *  - SMTP failure → 502 { error.message: "Mailbox rejected the message — check SMTP settings" }.
 *  - On success, best effort: APPEND the sent message to Sent via IMAP.
 *  - Demo mode: validates + returns a demo receipt (nothing is sent).
 */
import { Mailbox, classifyMailError } from "@/lib/mail/imap";
import { authorizeMail, jsonError, jsonOk, parseFolder } from "@/lib/mail/http";
import { getDemoMessage } from "@/lib/mail/demo-messages";
import { getDemoReplyReceipt } from "@/lib/mail/demo-messages";
import { parseEmailList, formatAddress, stripHeaderChars } from "@/lib/mail/mime";
import { checkReplyRateLimit } from "@/lib/mail/rate-limit";
import { sendMail, buildRawMessage } from "@/lib/email/send";
import { composeReplyBodies, replySubject } from "@/lib/email/templates";

const MAX_BODY = 10_000;

export async function POST(request: Request) {
  const access = await authorizeMail();
  if (!("demo" in access)) return access; // 401

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be JSON.");
  }
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  // ---- manual validation (no new deps) -----------------------------------
  const uidRaw = record.uid;
  const uid = typeof uidRaw === "number" ? uidRaw : Number(uidRaw);
  if (!Number.isInteger(uid) || uid < 1 || uid > 2_147_483_647) {
    return jsonError(400, "INVALID_UID", "uid must be a positive integer.");
  }
  const folder = parseFolder(typeof record.folder === "string" ? record.folder : null);
  if (!folder) return jsonError(400, "INVALID_FOLDER", "folder must be INBOX or Sent.");

  const bodyRaw = record.body;
  const body = typeof bodyRaw === "string" ? bodyRaw.trim() : "";
  if (body.length < 1 || body.length > MAX_BODY) {
    return jsonError(400, "INVALID_BODY", `body must be 1..${MAX_BODY} characters.`);
  }

  const cc = parseEmailList(typeof record.cc === "string" ? record.cc : undefined);
  if (cc === null) return jsonError(400, "INVALID_CC", "cc must be a comma-separated list of valid email addresses.");
  const bcc = parseEmailList(typeof record.bcc === "string" ? record.bcc : undefined);
  if (bcc === null) return jsonError(400, "INVALID_BCC", "bcc must be a comma-separated list of valid email addresses.");

  // ---- rate limit (best effort, per user) --------------------------------
  const rateKey = access.profile?.id ?? "demo:anonymous";
  const rate = checkReplyRateLimit(rateKey);
  if (!rate.ok) {
    return jsonError(
      429,
      "RATE_LIMITED",
      `Too many replies — please wait ${Math.ceil((rate.retryAfterSeconds ?? 600) / 60)} minute(s) and try again.`,
    );
  }

  // ---- load the original message -----------------------------------------
  let original: {
    from: { name: string; address: string } | null;
    to: { name: string; address: string }[];
    subject: string;
    date: string;
    messageId: string | null;
    references: string[];
    textPlainExcerpt: string;
    text: string;
  } | null = null;

  let mailbox: Mailbox | null = null;
  try {
    if (access.demo) {
      const demo = getDemoMessage(uid, folder);
      original = demo;
    } else {
      mailbox = await Mailbox.create();
      if (!mailbox) {
        return jsonError(502, "IMAP_UNAVAILABLE", "Could not reach the mailbox — check host, port and network.");
      }
      original = await mailbox.fetchMessage(folder, uid);
    }
    if (!original) return jsonError(404, "NOT_FOUND", "Message not found.");

    const recipient =
      folder === "INBOX"
        ? original.from?.address ?? null
        : original.to[0]?.address ?? original.from?.address ?? null;
    if (!recipient) {
      return jsonError(400, "NO_RECIPIENT", "This message has no replyable sender address.");
    }

    const fromAddress = original.from ? formatAddress(original.from) : "unknown sender";
    const originalId = original.messageId ? wrapMessageId(original.messageId) : null;
    const references = [...original.references.map(wrapMessageId), ...(originalId ? [originalId] : [])];
    const bodies = composeReplyBodies({
      originalFrom: fromAddress,
      originalDate: original.date,
      originalSubject: original.subject,
      originalExcerpt: original.textPlainExcerpt || original.text || "",
      body,
    });
    const subject = replySubject(stripHeaderChars(original.subject));
    const sendInput = {
      to: recipient,
      cc: cc.map((a) => a.address),
      bcc: bcc.map((a) => a.address),
      subject,
      text: bodies.text,
      html: bodies.html,
      inReplyTo: originalId ?? undefined,
      references,
    };

    if (access.demo) {
      // Nothing is actually sent in demo mode.
      return jsonOk({ demo: true, uid, folder, messageId: getDemoReplyReceipt(uid) });
    }

    const result = await sendMail(sendInput);
    if (!result.ok) {
      return jsonError(502, result.error?.code ?? "SMTP_UNKNOWN", "Mailbox rejected the message — check SMTP settings");
    }

    // Best effort: keep a copy in Sent so the thread lives in the mailbox.
    const rawMessage = await buildRawMessage(sendInput);
    if (rawMessage) {
      const appendMailbox = await Mailbox.create();
      if (appendMailbox) {
        try {
          await appendMailbox.appendToSent(rawMessage);
        } finally {
          await appendMailbox.close();
        }
      }
    }

    return jsonOk({ demo: false, uid, folder, messageId: result.messageId ?? null });
  } catch (err) {
    const info = classifyMailError(err);
    console.error(`[mail] reply failed for uid=${uid} (${info.code})`);
    return jsonError(502, info.code, info.message);
  } finally {
    if (mailbox) await mailbox.close();
  }
}

/** Ensure a message-id is wrapped in angle brackets for RFC 5322 headers. */
function wrapMessageId(id: string): string {
  const clean = id.trim().replace(/[\r\n]/g, "");
  if (clean.startsWith("<") && clean.endsWith(">")) return clean;
  return `<${clean.replace(/[<>]/g, "")}>`;
}
