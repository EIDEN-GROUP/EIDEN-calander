/**
 * templates.ts — outbound transactional email templates (SERVER-ONLY).
 *
 * Every template is bilingual (EN/FR) and returns { subject, html, text }.
 * HTML is table-based, inline-styled, bulletproof for mail clients:
 *   · Obsidian header with the CALENDAR. wordmark (white) + Electric pill dot
 *   · white card body, Electric Blue accents (#0066CC)
 *   · footer: "Eiden Group — eiden-group.com · contact@eiden-group.com"
 * All interpolated values are HTML-escaped. Bodies never include secrets
 * beyond the intended payload (temp password is the point, not a leak).
 */
import "server-only";
import type { BookingRow, FormationRow, RoomRow } from "@/lib/types/db";
import { escapeHtml } from "@/lib/mail/sanitize";
import { buildQuoteText, quoteAttribution } from "@/lib/mail/mime";

export type Locale = "en" | "fr";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const L = <T,>(locale: Locale, en: T, fr: T): T => (locale === "fr" ? fr : en);

function fmtDateTime(iso: string | Date, locale: Locale): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

const APP_BASE = "https://calendar.eiden-group.com";
const BRAND_FOOTER_TEXT = "Eiden Group — eiden-group.com · contact@eiden-group.com";

/** Shared layout. `preheader` is the inbox-preview line (hidden in the body). */
export function base(
  locale: Locale,
  title: string,
  preheader: string,
  bodyHtml: string,
  bodyText: string,
): RenderedEmail {
  const html = `<!DOCTYPE html>
<html lang="${locale}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;">
<!--[if mso]><style>table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;mso-hide:all;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F5F7;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
    <!-- Brand bar -->
    <tr><td style="background:#1D1D1F;border-radius:20px 20px 0 0;padding:26px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.04em;color:#FFFFFF;line-height:1;">CALENDAR<span style="color:#0066CC;">.</span></td>
          <td style="vertical-align:middle;padding-left:12px;"><span style="display:inline-block;width:11px;height:26px;border-radius:6px;background:#0066CC;"></span></td>
        </tr>
      </table>
      <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);">${L(locale, "Architecture for Time", "L’art du temps bien bâti")}</div>
    </td></tr>
    <!-- Card -->
    <tr><td style="background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);border-top:none;border-radius:0 0 20px 20px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#424245;font-size:15px;line-height:1.55;">
      ${bodyHtml}
      <!-- Footer -->
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;font-size:12px;color:#6E6E73;line-height:1.6;">${escapeHtml(BRAND_FOOTER_TEXT)}</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  const text = `CALENDAR. — Eiden Group
=======================

${bodyText}

—
${BRAND_FOOTER_TEXT}`;
  return { subject: title, html, text };
}

/** Label/value detail row used by detail lists. */
function detailRow(label: string, value: string): string {
  return `<tr>
  <td style="padding:7px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6E6E73;vertical-align:top;width:40%;">${escapeHtml(label)}</td>
  <td style="padding:7px 0;font-size:15px;color:#1D1D1F;vertical-align:top;">${escapeHtml(value)}</td>
</tr>`;
}

function detailsTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 4px;border-top:1px solid rgba(0,0,0,0.06);border-bottom:1px solid rgba(0,0,0,0.06);">${rows}</table>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;"><tr><td style="background:#0066CC;border-radius:999px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.04em;color:#1D1D1F;">${escapeHtml(text)}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;">${escapeHtml(text)}</p>`;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type BookingLike = Pick<BookingRow, "title" | "starts_at" | "ends_at"> &
  Partial<Pick<BookingRow, "notes" | "status">>;
export type RoomLike = Pick<RoomRow, "name" | "location"> & Partial<Pick<RoomRow, "capacity">>;
export type FormationLike = Partial<Pick<FormationRow, "capacity" | "status" | "description">> & {
  title: string;
  starts_at: string;
  ends_at?: string | null;
  room_name?: string | null;
};

export interface WelcomeTempPasswordInput {
  name: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  locale: Locale;
}

export interface BookingMailInput {
  booking: BookingLike;
  room: RoomLike;
  locale: Locale;
}

export interface ChangeRequestReceivedInput {
  incumbentName: string;
  requesterName: string;
  room: string;
  slot: string;
  suggested: number;
  locale: Locale;
}

export interface ChangeRequestResolutionInput {
  requesterName?: string | null;
  room: string;
  slot: string;
  responseMessage?: string | null;
  locale: Locale;
}

export interface ChangeRequestExpiryInput {
  requesterName?: string | null;
  room: string;
  slot: string;
  locale: Locale;
}

export interface FormationReminderInput {
  formation: FormationLike;
  /** Number of enrolled/confirmed participants to remind */
  count: number;
  locale: Locale;
}

export interface WeeklyDigestRow {
  room: string;
  bookings: number;
  hours: number;
  utilizationPct: number;
}

export interface WeeklyDigestInput {
  rows: WeeklyDigestRow[];
  weekLabel: string;
  locale: Locale;
}

/* ------------------------------------------------------------------ */
/* welcomeTempPassword — full EN/FR                                    */
/* ------------------------------------------------------------------ */

export function welcomeTempPassword(input: WelcomeTempPasswordInput): RenderedEmail {
  const { name, email, tempPassword, loginUrl, locale } = input;
  const subject = L(
    locale,
    "Welcome to CALENDAR. — your temporary password",
    "Bienvenue sur CALENDAR. — votre mot de passe temporaire",
  );
  const preheader = L(
    locale,
    "Your CALENDAR. account is ready — sign in with the temporary password below.",
    "Votre compte CALENDAR. est prêt — connectez-vous avec le mot de passe temporaire.",
  );
  const greeting = L(locale, `Hi ${name},`, `Bonjour ${name},`);
  const bodyHtml = `${h1(subject)}
${p(greeting)}
${p(
  L(
    locale,
    "An account has been created for you on CALENDAR. — Eiden Group’s internal scheduling platform (meeting rooms, formations and clients).",
    "Un compte vient d’être créé pour vous sur CALENDAR. — la plateforme interne de réservation d’Eiden Group (salles de réunion, formations et clients).",
  ),
)}
${p(L(locale, "Your temporary password:", "Votre mot de passe temporaire :"))}
<div style="margin:14px 0 4px;background:#F5F5F7;border:1px solid rgba(0,0,0,0.08);border-radius:14px;padding:16px 20px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:22px;letter-spacing:0.14em;color:#1D1D1F;user-select:all;">${escapeHtml(tempPassword)}</div>
${detailsTable(
  detailRow(L(locale, "Sign-in email", "Email de connexion"), email) +
    detailRow(L(locale, "Temporary password", "Mot de passe temporaire"), "••••••••••"),
)}
${p(
  L(
    locale,
    "You will be asked to choose a new password immediately after your first sign-in. This temporary password expires in 14 days.",
    "Vous devrez choisir un nouveau mot de passe dès votre première connexion. Ce mot de passe temporaire expire dans 14 jours.",
  ),
)}
${button(loginUrl, L(locale, "Sign in to CALENDAR.", "Se connecter à CALENDAR."))}
${p(
  L(
    locale,
    "If you were not expecting this email, contact your administrator or write to contact@eiden-group.com.",
    "Si vous n’êtes pas à l’origine de cette demande, contactez votre administrateur ou écrivez à contact@eiden-group.com.",
  ),
)}`;
  const text = L(
    locale,
    `${greeting}

An account has been created for you on CALENDAR. — Eiden Group’s internal scheduling platform.

Sign-in email: ${email}
Temporary password: ${tempPassword}

You will be asked to choose a new password immediately after your first sign-in. This temporary password expires in 14 days.

Sign in: ${loginUrl}

If you were not expecting this email, contact your administrator or write to contact@eiden-group.com.`,
    `${greeting}

Un compte vient d’être créé pour vous sur CALENDAR. — la plateforme interne de réservation d’Eiden Group.

Email de connexion : ${email}
Mot de passe temporaire : ${tempPassword}

Vous devrez choisir un nouveau mot de passe dès votre première connexion. Ce mot de passe temporaire expire dans 14 jours.

Se connecter : ${loginUrl}

Si vous n’êtes pas à l’origine de cette demande, contactez votre administrateur ou écrivez à contact@eiden-group.com.`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

/* ------------------------------------------------------------------ */
/* weeklyDigest — full EN/FR                                           */
/* ------------------------------------------------------------------ */

export function weeklyDigest(input: WeeklyDigestInput): RenderedEmail {
  const { rows, weekLabel, locale } = input;
  const totalBookings = rows.reduce((acc, r) => acc + r.bookings, 0);
  const totalHours = rows.reduce((acc, r) => acc + r.hours, 0);
  const avgUtil =
    rows.length === 0 ? 0 : Math.round(rows.reduce((acc, r) => acc + r.utilizationPct, 0) / rows.length);
  const subject = L(
    locale,
    `CALENDAR. — Weekly room digest · ${weekLabel}`,
    `CALENDAR. — Récapitulatif hebdo des salles · ${weekLabel}`,
  );
  const preheader = L(
    locale,
    `${totalBookings} bookings · ${totalHours}h · ${avgUtil}% average utilization this week.`,
    `${totalBookings} réservations · ${totalHours} h · ${avgUtil} % d’occupation moyenne cette semaine.`,
  );
  const headerCell = (label: string): string =>
    `<th align="left" style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6E6E73;border-bottom:2px solid #1D1D1F;">${escapeHtml(label)}</th>`;
  const bodyRows = rows
    .map(
      (r) => `<tr>
  <td style="padding:10px 12px;font-size:15px;font-weight:600;color:#1D1D1F;border-bottom:1px solid rgba(0,0,0,0.06);">${escapeHtml(r.room)}</td>
  <td style="padding:10px 12px;font-size:15px;color:#424245;border-bottom:1px solid rgba(0,0,0,0.06);font-variant-numeric:tabular-nums;">${r.bookings}</td>
  <td style="padding:10px 12px;font-size:15px;color:#424245;border-bottom:1px solid rgba(0,0,0,0.06);font-variant-numeric:tabular-nums;">${r.hours} h</td>
  <td style="padding:10px 12px;font-size:15px;border-bottom:1px solid rgba(0,0,0,0.06);font-variant-numeric:tabular-nums;"><span style="display:inline-block;min-width:44px;padding:3px 10px;border-radius:999px;background:${r.utilizationPct >= 70 ? "rgba(0,102,204,0.10)" : "rgba(255,159,10,0.16)"};color:${r.utilizationPct >= 70 ? "#005BB5" : "#A34D00"};font-weight:700;text-align:center;">${r.utilizationPct}%</span></td>
</tr>`,
    )
    .join("");
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 4px;">
<thead><tr>${headerCell(L(locale, "Room", "Salle"))}${headerCell(L(locale, "Bookings", "Réservations"))}${headerCell(L(locale, "Hours", "Heures"))}${headerCell(L(locale, "Utilization", "Occupation"))}</tr></thead>
<tbody>${bodyRows || `<tr><td colspan="4" style="padding:14px 12px;color:#6E6E73;">${L(locale, "No bookings this week.", "Aucune réservation cette semaine.")}</td></tr>`}</tbody>
<tfoot><tr>
  <td style="padding:12px;font-size:13px;font-weight:700;color:#1D1D1F;">${L(locale, "Total", "Total")}</td>
  <td style="padding:12px;font-size:13px;font-weight:700;color:#1D1D1F;font-variant-numeric:tabular-nums;">${totalBookings}</td>
  <td style="padding:12px;font-size:13px;font-weight:700;color:#1D1D1F;font-variant-numeric:tabular-nums;">${totalHours} h</td>
  <td style="padding:12px;font-size:13px;font-weight:700;color:#1D1D1F;font-variant-numeric:tabular-nums;">${avgUtil}%</td>
</tr></tfoot>
</table>`;
  const bodyHtml = `${h1(L(locale, "Weekly room digest", "Récapitulatif hebdo des salles"))}
${p(L(locale, `Week of ${weekLabel} — here is how Eiden Group’s rooms were used.`, `Semaine du ${weekLabel} — voici comment les salles d’Eiden Group ont été utilisées.`))}
${table}
${p(L(locale, "Figures are computed from confirmed bookings. Cancelled and pending-conflict slots are excluded.", "Les chiffres sont calculés sur les réservations confirmées. Les créneaux annulés et en conflit sont exclus."))}`;
  const rowsText = rows
    .map((r) => `· ${r.room} — ${r.bookings} ${L(locale, "bookings", "réservations")}, ${r.hours} h, ${r.utilizationPct}%`)
    .join("\n");
  const text = L(
    locale,
    `Weekly room digest — week of ${weekLabel}

${rowsText || "No bookings this week."}

Totals: ${totalBookings} bookings · ${totalHours} h · ${avgUtil}% average utilization

Figures are computed from confirmed bookings.`,
    `Récapitulatif hebdo des salles — semaine du ${weekLabel}

${rowsText || "Aucune réservation cette semaine."}

Totaux : ${totalBookings} réservations · ${totalHours} h · ${avgUtil} % d’occupation moyenne

Les chiffres sont calculés sur les réservations confirmées.`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

/* ------------------------------------------------------------------ */
/* bookingCreated / bookingUpdated / bookingCancelled                  */
/* ------------------------------------------------------------------ */

function bookingDetails(booking: BookingLike, room: RoomLike, locale: Locale): string {
  return detailsTable(
    detailRow(L(locale, "Title", "Intitulé"), booking.title) +
      detailRow(L(locale, "Room", "Salle"), room.capacity ? `${room.name} — ${room.location} (${room.capacity}p)` : `${room.name} — ${room.location}`) +
      detailRow(L(locale, "When", "Quand"), fmtDateTime(booking.starts_at, locale)) +
      detailRow(L(locale, "Until", "Jusqu’à"), fmtDateTime(booking.ends_at, locale)),
  );
}

export function bookingCreated(input: BookingMailInput): RenderedEmail {
  const { booking, room, locale } = input;
  const subject = L(locale, `Booking confirmed — ${booking.title}`, `Réservation confirmée — ${booking.title}`);
  const preheader = L(
    locale,
    `${room.name}, ${fmtDateTime(booking.starts_at, locale)}.`,
    `${room.name}, ${fmtDateTime(booking.starts_at, locale)}.`,
  );
  const bodyHtml = `${h1(L(locale, "Booking confirmed", "Réservation confirmée"))}
${p(L(locale, "Your booking is confirmed. Details below.", "Votre réservation est confirmée. Détails ci-dessous."))}
${bookingDetails(booking, room, locale)}
${button(`${APP_BASE}/calendar`, L(locale, "Open the calendar", "Ouvrir le calendrier"))}`;
  const text = L(
    locale,
    `Booking confirmed: ${booking.title}
Room: ${room.name} — ${room.location}
When: ${fmtDateTime(booking.starts_at, locale)} → ${fmtDateTime(booking.ends_at, locale)}
Open the calendar: ${APP_BASE}/calendar`,
    `Réservation confirmée : ${booking.title}
Salle : ${room.name} — ${room.location}
Quand : ${fmtDateTime(booking.starts_at, locale)} → ${fmtDateTime(booking.ends_at, locale)}
Ouvrir le calendrier : ${APP_BASE}/calendar`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

export function bookingUpdated(input: BookingMailInput): RenderedEmail {
  const { booking, room, locale } = input;
  const subject = L(locale, `Booking updated — ${booking.title}`, `Réservation modifiée — ${booking.title}`);
  const preheader = L(locale, "The details of your booking changed.", "Les détails de votre réservation ont changé.");
  const bodyHtml = `${h1(L(locale, "Booking updated", "Réservation modifiée"))}
${p(L(locale, "Your booking was modified. The latest details are below.", "Votre réservation a été modifiée. Les informations à jour sont ci-dessous."))}
${bookingDetails(booking, room, locale)}
${button(`${APP_BASE}/calendar`, L(locale, "Open the calendar", "Ouvrir le calendrier"))}`;
  const text = L(
    locale,
    `Booking updated: ${booking.title}
Room: ${room.name} — ${room.location}
When: ${fmtDateTime(booking.starts_at, locale)} → ${fmtDateTime(booking.ends_at, locale)}
Open the calendar: ${APP_BASE}/calendar`,
    `Réservation modifiée : ${booking.title}
Salle : ${room.name} — ${room.location}
Quand : ${fmtDateTime(booking.starts_at, locale)} → ${fmtDateTime(booking.ends_at, locale)}
Ouvrir le calendrier : ${APP_BASE}/calendar`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

export function bookingCancelled(input: BookingMailInput): RenderedEmail {
  const { booking, room, locale } = input;
  const subject = L(locale, `Booking cancelled — ${booking.title}`, `Réservation annulée — ${booking.title}`);
  const preheader = L(locale, "This booking has been cancelled and the slot is released.", "Cette réservation a été annulée et le créneau est libéré.");
  const bodyHtml = `${h1(L(locale, "Booking cancelled", "Réservation annulée"))}
${p(L(locale, "The following booking has been cancelled. The room is available again for the slot.", "La réservation suivante a été annulée. La salle est de nouveau disponible sur ce créneau."))}
${bookingDetails(booking, room, locale)}
${button(`${APP_BASE}/calendar`, L(locale, "Open the calendar", "Ouvrir le calendrier"))}`;
  const text = L(
    locale,
    `Booking cancelled: ${booking.title}
Room: ${room.name} — ${room.location}
When: ${fmtDateTime(booking.starts_at, locale)} → ${fmtDateTime(booking.ends_at, locale)}
Open the calendar: ${APP_BASE}/calendar`,
    `Réservation annulée : ${booking.title}
Salle : ${room.name} — ${room.location}
Quand : ${fmtDateTime(booking.starts_at, locale)} → ${fmtDateTime(booking.ends_at, locale)}
Ouvrir le calendrier : ${APP_BASE}/calendar`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

/* ------------------------------------------------------------------ */
/* change request lifecycle                                             */
/* ------------------------------------------------------------------ */

export function changeRequestReceived(input: ChangeRequestReceivedInput): RenderedEmail {
  const { incumbentName, requesterName, room, slot, suggested, locale } = input;
  const subject = L(
    locale,
    `Action needed — ${requesterName} requests ${room}`,
    `Action requise — ${requesterName} souhaite ${room}`,
  );
  const preheader = L(
    locale,
    `${slot} · ${suggested} suggested alternative${suggested === 1 ? "" : "s"} attached.`,
    `${slot} · ${suggested} créneau${suggested === 1 ? "" : "x"} alternatif${suggested === 1 ? "" : "s"} proposé${suggested === 1 ? "" : "s"}.`,
  );
  const bodyHtml = `${h1(L(locale, "Change request received", "Demande de modification reçue"))}
${p(L(locale, `Hi ${incumbentName}, ${requesterName} asked to take over your booking.`, `Bonjour ${incumbentName}, ${requesterName} souhaite reprendre votre réservation.`))}
${detailsTable(
  detailRow(L(locale, "Room", "Salle"), room) +
    detailRow(L(locale, "Slot", "Créneau"), slot) +
    detailRow(L(locale, "Suggested alternatives", "Alternatives proposées"), String(suggested)),
)}
${p(L(locale, "Review the request and either approve a swap or decline it. The request expires automatically if you do not respond.", "Analysez la demande et acceptez l’échange ou refusez-le. La demande expire automatiquement sans réponse."))}
${button(`${APP_BASE}/requests`, L(locale, "Review the request", "Examiner la demande"))}`;
  const text = L(
    locale,
    `Hi ${incumbentName},

${requesterName} asked to take over your booking.
Room: ${room}
Slot: ${slot}
Suggested alternatives: ${suggested}

Review the request: ${APP_BASE}/requests`,
    `Bonjour ${incumbentName},

${requesterName} souhaite reprendre votre réservation.
Salle : ${room}
Créneau : ${slot}
Alternatives proposées : ${suggested}

Examiner la demande : ${APP_BASE}/requests`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

export function changeRequestApproved(input: ChangeRequestResolutionInput): RenderedEmail {
  const { requesterName, room, slot, responseMessage, locale } = input;
  const subject = L(locale, `Request approved — ${room} · ${slot}`, `Demande acceptée — ${room} · ${slot}`);
  const preheader = L(locale, "The slot is yours. The calendar has been updated.", "Le créneau vous est attribué. Le calendrier a été mis à jour.");
  const greetingName = requesterName ? ` ${requesterName}` : "";
  const bodyHtml = `${h1(L(locale, "Request approved", "Demande acceptée"))}
${p(L(locale, `Hi${greetingName || ""}, your change request was approved.`, `Bonjour${greetingName || ""}, votre demande de modification a été acceptée.`))}
${detailsTable(detailRow(L(locale, "Room", "Salle"), room) + detailRow(L(locale, "Slot", "Créneau"), slot))}
${responseMessage ? p(L(locale, `Message: “${responseMessage}”`, `Message : « ${responseMessage} »`)) : ""}
${button(`${APP_BASE}/calendar`, L(locale, "Open the calendar", "Ouvrir le calendrier"))}`;
  const text = L(
    locale,
    `Your change request was approved.
Room: ${room}
Slot: ${slot}${responseMessage ? `\nMessage: ${responseMessage}` : ""}
Open the calendar: ${APP_BASE}/calendar`,
    `Votre demande de modification a été acceptée.
Salle : ${room}
Créneau : ${slot}${responseMessage ? `\nMessage : ${responseMessage}` : ""}
Ouvrir le calendrier : ${APP_BASE}/calendar`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

export function changeRequestDeclined(input: ChangeRequestResolutionInput): RenderedEmail {
  const { requesterName, room, slot, responseMessage, locale } = input;
  const subject = L(locale, `Request declined — ${room} · ${slot}`, `Demande refusée — ${room} · ${slot}`);
  const preheader = L(locale, "The incumbent kept the slot. Your request was declined.", "Le titulaire garde le créneau. Votre demande a été refusée.");
  const greetingName = requesterName ? ` ${requesterName}` : "";
  const bodyHtml = `${h1(L(locale, "Request declined", "Demande refusée"))}
${p(L(locale, `Hi${greetingName || ""}, your change request was declined. The current holder keeps the slot.`, `Bonjour${greetingName || ""}, votre demande de modification a été refusée. Le titulaire actuel garde le créneau.`))}
${detailsTable(detailRow(L(locale, "Room", "Salle"), room) + detailRow(L(locale, "Slot", "Créneau"), slot))}
${responseMessage ? p(L(locale, `Message: “${responseMessage}”`, `Message : « ${responseMessage} »`)) : ""}
${p(L(locale, "You can submit a new request with a different suggested slot at any time.", "Vous pouvez soumettre une nouvelle demande avec un autre créneau à tout moment."))}
${button(`${APP_BASE}/calendar`, L(locale, "Open the calendar", "Ouvrir le calendrier"))}`;
  const text = L(
    locale,
    `Your change request was declined.
Room: ${room}
Slot: ${slot}${responseMessage ? `\nMessage: ${responseMessage}` : ""}
Open the calendar: ${APP_BASE}/calendar`,
    `Votre demande de modification a été refusée.
Salle : ${room}
Créneau : ${slot}${responseMessage ? `\nMessage : ${responseMessage}` : ""}
Ouvrir le calendrier : ${APP_BASE}/calendar`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

export function changeRequestExpired(input: ChangeRequestExpiryInput): RenderedEmail {
  const { requesterName, room, slot, locale } = input;
  const subject = L(locale, `Request expired — ${room} · ${slot}`, `Demande expirée — ${room} · ${slot}`);
  const preheader = L(locale, "No response within the window — the request expired.", "Sans réponse dans le délai imparti — la demande a expiré.");
  const greetingName = requesterName ? ` ${requesterName}` : "";
  const bodyHtml = `${h1(L(locale, "Request expired", "Demande expirée"))}
${p(L(locale, `Hi${greetingName || ""}, your change request expired because the current holder did not respond within the allowed window.`, `Bonjour${greetingName || ""}, votre demande de modification a expiré car le titulaire n’a pas répondu dans le délai imparti.`))}
${detailsTable(detailRow(L(locale, "Room", "Salle"), room) + detailRow(L(locale, "Slot", "Créneau"), slot))}
${p(L(locale, "The original booking is unchanged. You may submit a new request with a different slot.", "La réservation d’origine est inchangée. Vous pouvez soumettre une nouvelle demande avec un autre créneau."))}
${button(`${APP_BASE}/calendar`, L(locale, "Open the calendar", "Ouvrir le calendrier"))}`;
  const text = L(
    locale,
    `Your change request expired.
Room: ${room}
Slot: ${slot}
The original booking is unchanged.
Open the calendar: ${APP_BASE}/calendar`,
    `Votre demande de modification a expiré.
Salle : ${room}
Créneau : ${slot}
La réservation d’origine est inchangée.
Ouvrir le calendrier : ${APP_BASE}/calendar`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

/* ------------------------------------------------------------------ */
/* formationReminder                                                   */
/* ------------------------------------------------------------------ */

export function formationReminder(input: FormationReminderInput): RenderedEmail {
  const { formation, count, locale } = input;
  const subject = L(
    locale,
    `Reminder — ${formation.title} · ${fmtDateTime(formation.starts_at, locale)}`,
    `Rappel — ${formation.title} · ${fmtDateTime(formation.starts_at, locale)}`,
  );
  const preheader = L(
    locale,
    "Your formation starts soon — arrival details inside.",
    "Votre formation commence bientôt — les informations pratiques sont à l’intérieur.",
  );
  const roomLine = formation.room_name ? formation.room_name : L(locale, "Room to be confirmed", "Salle à confirmer");
  const bodyHtml = `${h1(L(locale, "Formation reminder", "Rappel de formation"))}
${p(L(locale, `This is a reminder for “${formation.title}”.`, `Ceci est un rappel pour « ${formation.title} ».`))}
${detailsTable(
  detailRow(L(locale, "Formation", "Formation"), formation.title) +
    detailRow(L(locale, "When", "Quand"), fmtDateTime(formation.starts_at, locale)) +
    detailRow(L(locale, "Room", "Salle"), roomLine) +
    detailRow(L(locale, "Participants", "Participants"), String(count)),
)}
${p(L(locale, "Please arrive 10 minutes early. Bring a laptop if a hands-on session is planned.", "Merci d’arriver 10 minutes en avance. Apportez un ordinateur portable si une session pratique est prévue."))}
${button(`${APP_BASE}/formations`, L(locale, "View formation details", "Voir les détails de la formation"))}`;
  const text = L(
    locale,
    `Reminder — ${formation.title}
When: ${fmtDateTime(formation.starts_at, locale)}
Room: ${roomLine}
Participants: ${count}

Please arrive 10 minutes early.
Details: ${APP_BASE}/formations`,
    `Rappel — ${formation.title}
Quand : ${fmtDateTime(formation.starts_at, locale)}
Salle : ${roomLine}
Participants : ${count}

Merci d’arriver 10 minutes en avance.
Détails : ${APP_BASE}/formations`,
  );
  return { ...base(locale, subject, preheader, bodyHtml, text), subject };
}

/* ------------------------------------------------------------------ */
/* reply composition — used by the /api/mail/reply route               */
/* ------------------------------------------------------------------ */

export interface ReplyComposeInput {
  originalFrom: string;
  originalDate?: string | Date | null;
  originalSubject: string;
  originalExcerpt: string;
  body: string;
  locale?: Locale;
}

const REPLY_SUBJECT_RE = /^\s*(re|fwd?|wg|r)\s*:/i;

/** "Re: <original>" — the prefix is added only when absent. */
export function replySubject(originalSubject: string): string {
  const clean = stripSubject(originalSubject);
  return REPLY_SUBJECT_RE.test(clean) ? clean : `Re: ${clean}`;
}

function stripSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, " ").trim().slice(0, 450) || "(no subject)";
}

/** Plain-text + HTML bodies for the reply, with the quoted original embedded (escaped). */
export function composeReplyBodies(input: ReplyComposeInput): { html: string; text: string } {
  const attribution = quoteAttribution(input.originalFrom, input.originalDate);
  const quoteText = buildQuoteText({
    from: input.originalFrom,
    date: input.originalDate ?? undefined,
    bodyExcerpt: input.originalExcerpt,
  });
  const text = `${input.body.trim()}\n${quoteText}`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;color:#1D1D1F;line-height:1.55;white-space:normal;">${paragraphs(input.body)}</div>
<blockquote style="margin:20px 0 0;padding:4px 0 4px 14px;border-left:3px solid #0066CC;color:#424245;font-size:14px;">
<div style="color:#6E6E73;font-size:12px;margin-bottom:8px;">${escapeHtml(attribution)}</div>
<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;white-space:pre-wrap;">${escapeHtml(input.originalExcerpt.slice(0, 4000))}</div>
</blockquote>`;
  return { html, text };
}

function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px;">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
