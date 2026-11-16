-- 0006_booking_status_paused.sql
-- CALENDAR.: add a `paused` booking lifecycle state.
-- A paused booking is on hold: it keeps its record and history but does NOT
-- block the room (the availability guard only considers confirmed /
-- pending_conflict). Resume flips it back to confirmed.
-- Idempotent: safe to re-run.

alter type public.booking_status add value if not exists 'paused';

comment on type public.booking_status is
  'Booking lifecycle: confirmed · pending_conflict (awaiting incumbent approval) · paused (on hold — frees the room) · cancelled · completed';
