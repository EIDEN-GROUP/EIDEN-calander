/**
 * Minimal emergency fixtures, used ONLY when the /api/mail/* endpoints are
 * unreachable (offline preview, server down). The real demo fixtures live
 * server-side in lib/mail/demo-messages.ts and are served by the API with
 * { demo: true }: those are the primary demo path.
 *
 * Anything rendered through here is static presentational content; bodies are
 * pre-sanitized text (no HTML at all).
 */
import type { MailFolder, MailMessage, MailMessageSummary } from "./types";

const CONTACT = { name: "Eiden Group", address: "contact@eiden-group.com" };

const FIXTURES: Record<MailFolder, MailMessageSummary[]> = {
  INBOX: [
    {
      uid: 9901, seq: 9901,
      from: { name: "Nadia Bensaïd", address: "nadia@acme-sarl.ma" },
      to: [CONTACT], cc: [],
      subject: "Booking confirmation: Salle Grande, Tuesday 10:00",
      date: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      seen: false, hasAttachments: true, size: 18_432,
      preview: "Bonjour, nous confirmons notre réservation de la Salle Grande pour mardi…",
    },
    {
      uid: 9902, seq: 9902,
      from: { name: "Khadija El Amrani", address: "k.elamrani@marjanemaroc.ma" },
      to: [CONTACT], cc: [],
      subject: "Formation enrollment: React Avancé S3 (CSV)",
      date: new Date(Date.now() - 6 * 3_600_000).toISOString(),
      seen: false, hasAttachments: true, size: 24_108,
      preview: "Ci-joint la liste des participants pour la session React Avancé S3…",
    },
    {
      uid: 9903, seq: 9903,
      from: { name: "Comptabilité", address: "compta@attijariwafa.com" },
      to: [CONTACT], cc: [],
      subject: "Invoice #2026-014: question",
      date: new Date(Date.now() - 26 * 3_600_000).toISOString(),
      seen: true, hasAttachments: false, size: 12_640,
      preview: "Facture #2026-014 : le montant HT semble différer du bon de commande N°4471…",
    },
  ],
  Sent: [
    {
      uid: 9906, seq: 9906,
      from: CONTACT,
      to: [{ name: "Nadia Bensaïd", address: "nadia@acme-sarl.ma" }], cc: [],
      subject: "Re: Booking confirmation: Salle Grande, Tuesday 10:00",
      date: new Date(Date.now() - 1 * 3_600_000).toISOString(),
      seen: true, hasAttachments: false, size: 11_284,
      preview: "Bien noté : Salle Grande, mardi 10:00, 12 personnes confirmées…",
    },
    {
      uid: 9907, seq: 9907,
      from: CONTACT,
      to: [{ name: "Khadija El Amrani", address: "k.elamrani@marjanemaroc.ma" }], cc: [],
      subject: "Confirmation : Formation Leadership T4",
      date: new Date(Date.now() - 28 * 3_600_000).toISOString(),
      seen: true, hasAttachments: false, size: 14_051,
      preview: "Votre inscription à la Formation Leadership T4 est confirmée…",
    },
  ],
};

export function getFallbackList(folder: MailFolder): MailMessageSummary[] {
  return FIXTURES[folder];
}

export function getFallbackMessage(uid: number, folder: MailFolder): MailMessage | null {
  const found = FIXTURES[folder].find((m) => m.uid === uid);
  if (!found) return null;
  return {
    ...found,
    html: null,
    text:
      "This is an offline preview render: the CALENDAR. mail API was unreachable,\n" +
      "so the inbox is showing built-in placeholder fixtures.\n\n" +
      "Start the dev server and reload to see the live demo data, or\n" +
      "connect the Hostinger mailbox via .env to go live.",
    messageId: null,
    inReplyTo: null,
    references: [],
    attachments: [],
    textPlainExcerpt: "",
  };
}
