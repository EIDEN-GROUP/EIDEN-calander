-- 0003_indexes_triggers.sql
-- CALENDAR.: indexes + baseline seed data required for the app to function.
-- Baseline seed (working hours, system categories, business settings) is part of
-- the migration on purpose: every environment needs identical system rows.
-- Demo/sample content lives ONLY in supabase/seed.sql (staging/local).

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Overlap lookups for the confirmed/pending_conflict booking set of a room
create index if not exists bookings_room_period_idx
  on public.bookings (room_id, starts_at, ends_at)
  where status in ('confirmed', 'pending_conflict');

create index if not exists bookings_starts_at_idx on public.bookings (starts_at);
create index if not exists bookings_client_id_idx on public.bookings (client_id);
create index if not exists bookings_title_trgm_idx on public.bookings using gin (title gin_trgm_ops);

create index if not exists clients_full_name_trgm_idx on public.clients using gin (full_name gin_trgm_ops);
create index if not exists clients_tags_idx on public.clients using gin (tags);

create index if not exists formation_participants_booking_id_idx on public.formation_participants (booking_id);

create index if not exists plans_target_date_idx on public.plans (target_date);

create index if not exists notifications_user_unread_idx on public.notifications (user_id, read_at, created_at desc);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

create index if not exists change_requests_assigned_pending_idx
  on public.change_requests (assigned_to)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- working_hours: Mon–Sat open 08:00–20:00, Sunday closed
-- ---------------------------------------------------------------------------
insert into public.working_hours (weekday, is_open, open_time, close_time) values
  ('mon', true,  '08:00', '20:00'),
  ('tue', true,  '08:00', '20:00'),
  ('wed', true,  '08:00', '20:00'),
  ('thu', true,  '08:00', '20:00'),
  ('fri', true,  '08:00', '20:00'),
  ('sat', true,  '08:00', '20:00'),
  ('sun', false, '08:00', '20:00')
on conflict (weekday) do nothing;

-- ---------------------------------------------------------------------------
-- categories: system categories (idempotent: insert only if missing by name)
-- ---------------------------------------------------------------------------
insert into public.categories (name_en, name_fr, color, icon, type, is_system, is_active, sort)
select 'Meeting Room Rental', 'Location de salle de réunion', 'blue', 'calendar', 'standard', true, true, 1
where not exists (select 1 from public.categories where name_en = 'Meeting Room Rental');

insert into public.categories (name_en, name_fr, color, icon, type, is_system, is_active, sort)
select 'Formation', 'Formation', 'green', 'graduation-cap', 'formation', true, true, 2
where not exists (select 1 from public.categories where name_en = 'Formation');

insert into public.categories (name_en, name_fr, color, icon, type, is_system, is_active, sort)
select 'Event', 'Événement', 'purple', 'sparkles', 'standard', true, true, 3
where not exists (select 1 from public.categories where name_en = 'Event');

-- ---------------------------------------------------------------------------
-- business_settings: singleton row (Eiden Group). Insert once, never overwrite.
-- ---------------------------------------------------------------------------
insert into public.business_settings (
  id, business_name, public_url, timezone, currency, default_locale, country
) values (
  true, 'Eiden Group', 'https://eiden-group.com',
  'Africa/Casablanca', 'MAD', 'en', 'Morocco'
)
on conflict (id) do nothing;
