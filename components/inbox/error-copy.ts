/**
 * Maps wire error codes (from /api/mail/* and the client fetch layer) to inbox
 * translation keys. Unknown codes fall back to the server-provided message.
 */
export const KNOWN_MAIL_ERROR_KEYS: Record<string, string> = {
  UNAUTHENTICATED: "errorUnauthenticated",
  IMAP_AUTH: "errorImapAuth",
  IMAP_UNAVAILABLE: "errorImapUnavailable",
  IMAP_UNKNOWN: "errorImapUnknown",
  NETWORK: "errorNetwork",
  NOT_FOUND: "errorNotFound",
};

export function mailErrorMessage(
  t: (key: string) => string,
  error: { code: string; message: string },
): string {
  const key = KNOWN_MAIL_ERROR_KEYS[error.code];
  return key ? t(key) : error.message;
}
