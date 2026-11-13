/**
 * rate-limit.ts — best-effort reply rate limiting (SERVER-ONLY).
 *
 * In-memory token window: at most `limit` replies per `windowMs` per userId.
 * Module-scope Map, pruned on every write. This is per-instance and lost on
 * redeploy/restart — acceptable for a single-instance internal preview.
 *
 * TODO(WIRE): move enforcement to the edge / Upstash (or Hostinger-side caps)
 * before multi-instance deployment. Not a security boundary on its own — the
 * SMTP layer additionally authenticates as the mailbox owner, so abuse here is
 * limited to authenticated staff.
 */
import "server-only";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LIMIT = 30; // replies per window per user

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the oldest hit leaves the window (for Retry-After/UX). */
  retryAfterSeconds?: number;
}

export function checkReplyRateLimit(userId: string, now = Date.now()): RateLimitResult {
  const windowStart = now - WINDOW_MS;
  const recent = (hits.get(userId) ?? []).filter((t) => t > windowStart);
  if (recent.length >= LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
    hits.set(userId, recent);
    return { ok: false, retryAfterSeconds };
  }
  recent.push(now);
  hits.set(userId, recent);
  return { ok: true };
}

/** Test hook — clear all windows. */
export function __resetReplyRateLimit(): void {
  hits.clear();
}
