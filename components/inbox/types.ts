/**
 * Client-side mirror of the mail API payloads (JSON over the wire).
 * lib/mail/* is server-only and cannot be imported from client components —
 * keep these types in sync with lib/mail/imap.ts.
 */
export type MailFolder = "INBOX" | "Sent";

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailMessageSummary {
  uid: number;
  seq: number;
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  /** ISO-8601 */
  date: string;
  seen: boolean;
  hasAttachments: boolean;
  size: number;
  preview: string;
}

export interface MailAttachmentMeta {
  part: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface MailMessage extends MailMessageSummary {
  html: string | null;
  text: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  attachments: MailAttachmentMeta[];
  textPlainExcerpt: string;
}

export interface MailApiSuccess<T> {
  ok: true;
  demo?: boolean;
  offline?: boolean;
  search?: { source: string; q: string };
  message?: T;
  messages?: MailMessageSummary[];
}

export class MailApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MailApiError";
  }
}
