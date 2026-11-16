/**
 * POST /api/mail/test-send
 * Sends a branded test email to the *signed-in user's own address* via SMTP.
 * Exists so Settings → Notifications can offer a real "Send test email to me"
 * instead of a simulated one. Session required (never sends otherwise),
 * recipient is never caller-supplied. Demo mode returns a demo receipt.
 */
import { connection } from "next/server";
import { authorizeMail, jsonError, jsonOk } from "@/lib/mail/http";
import { sendMail } from "@/lib/email/send";
import { base } from "@/lib/email/templates";

export async function POST() {
  // No request data is read: opt out of build-time prerendering explicitly.
  await connection();
  const access = await authorizeMail();
  if (!("demo" in access)) return access; // 401

  if (access.demo) {
    return jsonOk({ demo: true, sent: false, note: "Demo mode: nothing was sent." });
  }

  const to = access.profile?.email;
  if (!to) return jsonError(400, "NO_RECIPIENT", "Your account has no email address.");

  const rendered = base(
    "en",
    "CALENDAR. · test email",
    "This is the test email from CALENDAR. Settings → Notifications.",
    `<p style="margin:0 0 12px;font-size:15px;">Hi${typeof access.profile?.full_name === "string" && access.profile.full_name.trim() ? ` ${access.profile.full_name.split(" ")[0]}` : ""},</p>
       <p style="margin:0 0 12px;font-size:15px;">This is the test email from <strong>CALENDAR.</strong>: Settings, Notifications, "Send test email to me".</p>
       <p style="margin:0;font-size:15px;">If it reached you, transactional mail works: bookings, changes and reminders will be delivered from this address.</p>`,
    `Hi,\n\nThis is the test email from CALENDAR. · Settings, Notifications, "Send test email to me".\n\nIf it reached you, transactional mail works: bookings, changes and reminders will be delivered from this address.`,
  );
  // base() sets subject to its title argument.
  const result = await sendMail({
    to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });

  if (!result.ok) {
    return jsonError(502, result.error?.code ?? "SMTP_UNKNOWN", result.error?.message ?? "The mailbox rejected the test message.");
  }
  return jsonOk({ sent: true, messageId: result.messageId ?? null });
}
