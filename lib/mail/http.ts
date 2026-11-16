/**
 * http.ts: shared helpers for /api/mail/* route handlers (SERVER-ONLY).
 * Centralizes the auth rule and the demo-mode fallback so every route
 * behaves identically:
 *
 *  - mail configured + no session   → 401 { ok:false, error:{code:"UNAUTHENTICATED"} }
 *  - mail NOT configured (demo)     → 200 with fixtures + { demo: true }
 *  - mail configured + session      → real mailbox path
 *
 * All responses carry `Cache-Control: private, no-store`.
 */
import "server-only";
import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { isMailConfigured } from "./imap";
import type { ProfileRow } from "@/lib/types/db";
import type { MailFolder } from "./imap";

const NO_STORE = "private, no-store";

export function jsonOk(data: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(
    { ok: true, ...data },
    { status, headers: { "Cache-Control": NO_STORE } },
  );
}

export function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": NO_STORE } },
  );
}

export function unauthorized(): NextResponse {
  return jsonError(401, "UNAUTHENTICATED", "You must be signed in to use the mailbox.");
}

export interface MailAccess {
  profile: ProfileRow | null;
  demo: boolean;
}

/** Returns MailAccess, or a ready-to-return 401 response when refused. */
export async function authorizeMail(): Promise<MailAccess | NextResponse> {
  const demo = !isMailConfigured();
  let profile: ProfileRow | null = null;
  try {
    profile = await getSessionProfile();
  } catch {
    profile = null; // auth backend unreachable: treat as signed out
  }
  if (!profile && !demo) return unauthorized();
  return { profile, demo };
}

const FOLDER_RE = /^(INBOX|Sent)$/;

/** Parse & validate a ?folder= query param. */
export function parseFolder(raw: string | null): MailFolder | null {
  if (raw == null) return "INBOX";
  return FOLDER_RE.test(raw) ? (raw as MailFolder) : null;
}

/** Parse & validate a ?uid= (positive integer). */
export function parseUid(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) return null;
  return n;
}

/** Body part identifiers: "2", "1.3", …: digits and dots only. */
export function parsePart(raw: string | null): string | null {
  if (raw == null) return null;
  return /^\d{1,3}(\.\d{1,3}){0,4}$/.test(raw) ? raw : null;
}
