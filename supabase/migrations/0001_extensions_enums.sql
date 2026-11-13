-- 0001_extensions_enums.sql
-- CALENDAR. — Eiden Group internal scheduling system
-- Extensions + enum types. Runs clean on a fresh database (PostgreSQL 15+ / Supabase).
-- File order matters: 0001 -> 0002 -> 0003 -> 0004 -> 0005.

-- ---------------------------------------------------------------------------
-- Extensions
--   pgcrypto  : gen_random_uuid() (PG 13+ also has it built in, but keep it explicit)
--   citext    : case-insensitive email columns
--   pg_trgm   : trigram indexes for fuzzy search on names/titles/tags
--   moddatetime: intentionally NOT used; updated_at is maintained by the
--                custom set_updated_at() trigger in 0004_functions.sql
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

-- Application roles. admin = full admin, staff = operations only.
create type public.user_role as enum ('admin', 'staff');

-- Booking categories: standard room rental vs. formation (training) sessions.
create type public.booking_type as enum ('standard', 'formation');

-- Booking lifecycle. 'pending_conflict' = requested slot conflicts with an
-- existing booking and is awaiting resolution via change_requests.
create type public.booking_status as enum ('confirmed', 'pending_conflict', 'cancelled', 'completed');

-- Status of a change request raised when a booking collides with another.
create type public.request_status as enum ('pending', 'approved', 'declined', 'cancelled', 'expired');

create type public.client_status as enum ('lead', 'active', 'inactive');

create type public.participant_status as enum ('enrolled', 'confirmed', 'attended', 'no_show', 'cancelled');

create type public.formation_status as enum ('draft', 'open', 'full', 'ongoing', 'completed', 'cancelled');

create type public.plan_status as enum ('planning', 'active', 'on_hold', 'completed', 'cancelled');

create type public.plan_priority as enum ('low', 'medium', 'high');

create type public.task_status as enum ('todo', 'in_progress', 'done');

create type public.weekday as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
