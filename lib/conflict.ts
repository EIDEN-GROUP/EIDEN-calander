/**
 * CALENDAR. · double-booking detection (pure, unit-tested).
 * The DB trigger `guard_booking_overlap()` is the seatbelt; this module is the UX layer.
 */

export interface OverlapCandidate {
  id: string;
  room_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  title?: string;
  created_by?: string;
}

export const ACTIVE_BOOKING_STATUSES = new Set(["confirmed", "pending_conflict"]);

export function isActiveBookingStatus(status: string): boolean {
  return ACTIVE_BOOKING_STATUSES.has(status);
}

/** Half-open interval overlap: [aStart, aEnd) × [bStart, bEnd). Touching endpoints do NOT conflict. */
export function rangesOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && ae > bs;
}

/**
 * Find active bookings in `candidates` that occupy `roomId` during [start, end).
 * - excludes `excludeId` (self on edit)
 * - roomless bookings never room-conflict
 * - touching endpoints are fine
 */
export function findOverlaps(
  roomId: string | null,
  start: Date | string,
  end: Date | string,
  candidates: OverlapCandidate[],
  excludeId?: string,
): OverlapCandidate[] {
  if (!roomId) return [];
  return candidates.filter(
    (c) =>
      c.id !== excludeId &&
      c.room_id === roomId &&
      isActiveBookingStatus(c.status) &&
      rangesOverlap(start, end, c.starts_at, c.ends_at),
  );
}

export function hasConflict(
  roomId: string | null,
  start: Date | string,
  end: Date | string,
  candidates: OverlapCandidate[],
  excludeId?: string,
): boolean {
  return findOverlaps(roomId, start, end, candidates, excludeId).length > 0;
}

/** Same client double-booked in a *different room* → soft badge, never a block. */
export function sameClientDifferentRoom(
  clientId: string | null | undefined,
  roomId: string | null,
  start: Date | string,
  end: Date | string,
  candidates: OverlapCandidate[] & { client_id?: string | null },
  excludeId?: string,
): OverlapCandidate[] {
  if (!clientId) return [];
  return candidates.filter(
    (c) =>
      c.id !== excludeId &&
      (c as { client_id?: string | null }).client_id === clientId &&
      c.room_id !== roomId &&
      isActiveBookingStatus(c.status) &&
      rangesOverlap(start, end, c.starts_at, c.ends_at),
  );
}
