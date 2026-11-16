/**
 * send.ts — outbound SMTP via nodemailer (SERVER-ONLY).
 *
 *  - getTransporter() caches a single transporter across invocations/lambda
 *    reuse in the same instance (module-scope cache).
 *  - secure=true for port 465 (implicit TLS), STARTTLS (secure=false) for 587.
 *  - Reads SMTP_* env ONLY. Credentials never leave this module, never logged.
 *  - sendMail NEVER throws — returns { ok, messageId?, error? }.
 *  - SMTP errors are classified; messages are human and credential-free.
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type SmtpErrorCode = "SMTP_UNAVAILABLE" | "SMTP_AUTH" | "SMTP_UNKNOWN" | "SMTP_UNCONFIGURED";

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: { code: SmtpErrorCode; message: string };
}

const SMTP_HOST = (process.env.SMTP_HOST ?? "smtp.hostinger.com").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
const SMTP_USER = process.env.SMTP_USER?.trim();
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM?.trim() || (SMTP_USER ? `Eiden Group <${SMTP_USER}>` : undefined);

let cached: Transporter | null = null;

/** True when the SMTP env is complete enough to attempt a send. */
export function isSmtpConfigured(): boolean {
  return Boolean(SMTP_HOST && Number.isFinite(SMTP_PORT) && SMTP_USER && SMTP_PASSWORD && EMAIL_FROM);
}

/** The fixed sender identity — never caller-supplied (no spoofing). */
export function getFromIdentity(): string {
  return EMAIL_FROM ?? "Eiden Group";
}

export function getTransporter(): Transporter {
  if (cached) return cached;
  const secure = SMTP_PORT === 465;
  cached = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure, // 465 → implicit TLS; 587 → plain + STARTTLS via requireTLS below
    requireTLS: !secure, // 587: refuse to send unless STARTTLS upgrade succeeds
    auth: { user: SMTP_USER as string, pass: SMTP_PASSWORD as string },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 20000,
    tls: { minVersion: "TLSv1.2" },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return cached;
}

export interface SendMailInput {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
  /** Reply threading — sets In-Reply-To + References */
  inReplyTo?: string;
  references?: string | string[];
}

/**
 * Send one transactional email. Never throws.
 * On failure returns { ok: false, error: { code, message } } where message is
 * a sanitized, human string ("Mailbox rejected the message — check SMTP settings").
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (!isSmtpConfigured()) {
    return {
      ok: false,
      error: { code: "SMTP_UNCONFIGURED", message: "Mailbox rejected the message — check SMTP settings" },
    };
  }
  const headers = { ...(input.headers ?? {}) };
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) {
    headers["References"] = Array.isArray(input.references) ? input.references.join(" ") : input.references;
  }
  try {
    const info = await getTransporter().sendMail({
      from: getFromIdentity(),
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      html: input.html,
      headers,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const code = classifySmtpError(err);
    console.error(`[email] send failed (${code})`);
    return {
      ok: false,
      error: { code, message: "Mailbox rejected the message — check SMTP settings" },
    };
  }
}

/** Verify the SMTP connection (used by /api/mail/test). Never throws. */
export async function verifyTransporter(): Promise<{ ok: boolean; code?: SmtpErrorCode }> {
  if (!isSmtpConfigured()) return { ok: false, code: "SMTP_UNCONFIGURED" };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    const code = classifySmtpError(err);
    console.error(`[email] verify failed (${code})`);
    return { ok: false, code };
  }
}

/**
 * Serialize a message to a raw RFC822 Buffer WITHOUT sending it.
 * Used for the best-effort APPEND to Sent after a successful SMTP send.
 * Returns null on failure. Never throws.
 */
export async function buildRawMessage(input: SendMailInput): Promise<Buffer | null> {
  try {
    const stream = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "unix",
    });
    const headers = { ...(input.headers ?? {}) };
    if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
    if (input.references) {
      headers["References"] = Array.isArray(input.references) ? input.references.join(" ") : input.references;
    }
    const info = (await stream.sendMail({
      from: getFromIdentity(),
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      html: input.html,
      headers,
    })) as unknown as { message?: Buffer | string };
    if (!info.message) return null;
    return Buffer.isBuffer(info.message) ? info.message : Buffer.from(info.message);
  } catch {
    return null;
  }
}

export function classifySmtpError(err: unknown): SmtpErrorCode {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  const responseCode =
    err && typeof err === "object" && "responseCode" in err
      ? Number((err as { responseCode?: unknown }).responseCode ?? 0)
      : 0;
  if (responseCode === 535 || responseCode === 534 || /auth/i.test(code)) return "SMTP_AUTH";
  if (
    /^(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EPIPE|ESOCKET|EDNS|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|ESOCKETTIMEDOUT|ETIMEDOUT)$/i.test(
      code,
    ) ||
    /timeout/i.test(code)
  ) {
    return "SMTP_UNAVAILABLE";
  }
  return "SMTP_UNKNOWN";
}
