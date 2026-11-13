/**
 * GET /api/mail/test — connectivity check for the mail path.
 *
 * Never returns credentials or host details beyond ok/not-ok per layer.
 * Demo mode → everything reported ok with { demo: true }.
 */
import { connection } from "next/server";
import { Mailbox, classifyMailError, isMailConfigured } from "@/lib/mail/imap";
import { verifyTransporter, isSmtpConfigured } from "@/lib/email/send";
import { authorizeMail, jsonOk } from "@/lib/mail/http";

export async function GET() {
  // Reads no request data — opt out of build-time prerendering explicitly.
  await connection();
  const access = await authorizeMail();
  if (!("demo" in access)) return access; // 401

  if (access.demo) {
    return jsonOk({
      demo: true,
      note: "Demo mode — connect IMAP/SMTP in the environment to go live.",
      imap: { ok: true },
      smtp: { ok: true },
    });
  }

  const smtp = await verifyTransporter();

  const mailbox = await Mailbox.create();
  let imap: { ok: boolean; code?: string; message?: string };
  if (mailbox) {
    try {
      await mailbox.getFolders();
      imap = { ok: true };
    } catch (err) {
      const info = classifyMailError(err);
      imap = { ok: false, code: info.code, message: info.message };
    } finally {
      await mailbox.close();
    }
  } else {
    imap = { ok: false, code: "IMAP_UNAVAILABLE", message: "Could not reach the mailbox — check host, port and network." };
  }

  return jsonOk({
    demo: false,
    configured: {
      imap: isMailConfigured(),
      smtp: isSmtpConfigured(),
    },
    imap,
    smtp: { ok: smtp.ok, ...(smtp.code ? { code: smtp.code } : {}) },
  });
}
