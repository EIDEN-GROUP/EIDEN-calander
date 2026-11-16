/**
 * GET /api/mail/attachment?uid=&folder=&part=&name=
 *
 * Force-downloads one attachment. NEVER inline-rendered:
 *   Content-Disposition: attachment; filename="<base name only>"
 *   X-Content-Type-Options: nosniff
 *   Content-Type: original (fallback application/octet-stream)
 *   Content-Length set; Cache-Control private, no-store.
 *
 * Constraints: 25 MB cap (413 when exceeded) · filename base-name only,
 * [\r\n/\\] stripped · `part` restricted to numeric dotted identifiers ·
 * the part must be a real attachment part (inline body parts are refused).
 */
import {
  Mailbox,
  MAX_ATTACHMENT_BYTES,
  classifyMailError,
} from "@/lib/mail/imap";
import {
  authorizeMail,
  jsonError,
  parseFolder,
  parsePart,
  parseUid,
} from "@/lib/mail/http";
import { getDemoAttachment } from "@/lib/mail/demo-messages";
import { safeFilename } from "@/lib/mail/mime";

export async function GET(request: Request) {
  const access = await authorizeMail();
  if (!("demo" in access)) return access; // 401

  const url = new URL(request.url);
  const uid = parseUid(url.searchParams.get("uid"));
  const folder = parseFolder(url.searchParams.get("folder"));
  const part = parsePart(url.searchParams.get("part"));
  const nameParam = url.searchParams.get("name");
  if (uid == null) return jsonError(400, "INVALID_UID", "uid must be a positive integer.");
  if (!folder) return jsonError(400, "INVALID_FOLDER", "folder must be INBOX or Sent.");
  if (!part) return jsonError(400, "INVALID_PART", "part must look like “2” or “1.3”.");

  const downloadName = (fallback: string) =>
    safeFilename(nameParam ?? fallback);

  if (access.demo) {
    const att = getDemoAttachment(uid, folder, part);
    if (!att) return jsonError(404, "NOT_FOUND", "Attachment not found.");
    const body = Buffer.from(att.content, "utf8");
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: downloadHeaders(body.length, att.contentType, downloadName(att.filename)),
    });
  }

  const mailbox = await Mailbox.create();
  if (!mailbox) {
    return jsonError(502, "IMAP_UNAVAILABLE", "Could not reach the mailbox: check host, port and network.");
  }
  try {
    const result = await mailbox.downloadAttachment(folder, uid, part);
    if (!result) return jsonError(404, "NOT_FOUND", "Attachment not found.");
    if (result.tooLarge) {
      return jsonError(413, "ATTACHMENT_TOO_LARGE", `Attachment exceeds the ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB limit.`);
    }
    return new Response(new Uint8Array(result.content), {
      status: 200,
      headers: downloadHeaders(result.content.length, result.contentType, downloadName(result.filename)),
    });
  } catch (err) {
    const info = classifyMailError(err);
    console.error(`[mail] attachment download failed for uid=${uid} part=${part} (${info.code})`);
    return jsonError(502, info.code, info.message);
  } finally {
    await mailbox.close();
  }
}

function downloadHeaders(length: number, contentType: string, filename: string): HeadersInit {
  const safe = safeFilename(filename);
  const ascii = /^[\x20-\x7E]+$/.test(safe) ? safe.replace(/"/g, "'") : "attachment";
  const disposition = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRFC5987(safe)}`;
  return {
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "Content-Length": String(length),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}

function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
