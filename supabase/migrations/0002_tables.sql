-- 0002_tables.sql
-- CALENDAR. — Eiden Group internal scheduling system
-- All tables. UUID primary keys (gen_random_uuid()) and timestamptz defaults (now()).
-- Dependency order: profiles -> business_settings/working_hours -> categories/rooms
--                   -> clients -> bookings -> formations -> formation_participants
--                   -> plans -> plan_tasks -> change_requests -> notifications -> audit_log

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users, created by admins (never self-registered)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                citext not null unique,
  full_name            text not null,
  phone                text,
  avatar_url           text,
  role                 public.user_role not null default 'staff',
  is_active            boolean not null default true,
  must_change_password boolean not null default true,
  locale               text not null default 'en' check (locale in ('en', 'fr')),
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- business_settings — singleton row (id is always true)
-- ---------------------------------------------------------------------------
create table public.business_settings (
  id                 boolean primary key default true check (id),
  business_name      text not null,
  legal_name         text,
  logo_url           text,
  email              text,
  phone              text,
  address            text,
  city               text,
  country            text default 'Morocco',
  timezone           text not null default 'Africa/Casablanca',
  currency           char(3) not null default 'MAD',
  public_url         text default 'https://eiden-group.com',
  slot_increment_min int not null default 30 check (slot_increment_min in (15, 30, 60)),
  buffer_min         int not null default 0,
  min_notice_hours   int not null default 2,
  week_starts        text not null default 'mon',
  default_locale     text not null default 'en' check (default_locale in ('en', 'fr')),
  updated_by         uuid,
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- working_hours — one row per weekday
-- ---------------------------------------------------------------------------
create table public.working_hours (
  weekday    public.weekday primary key,
  is_open    boolean not null default true,
  open_time  time not null default '08:00',
  close_time time not null default '20:00',
  constraint working_hours_open_before_close check (open_time < close_time)
);

-- ---------------------------------------------------------------------------
-- categories — booking categories (system ones shipped in migration 0003)
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name_en    text not null,
  name_fr    text,
  color      text not null default 'blue',
  icon       text not null default 'calendar',
  type       public.booking_type not null default 'standard',
  is_system  boolean not null default false,
  is_active  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rooms — rentable rooms / spaces
-- ---------------------------------------------------------------------------
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text not null default 'Casablanca',
  capacity    int not null check (capacity > 0),
  hourly_rate numeric(10, 2) not null default 0 check (hourly_rate >= 0),
  currency    char(3) not null default 'MAD',
  amenities   text[] not null default '{}',
  is_active   boolean not null default true,
  sort        int not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- clients — people / companies (soft-deletable, anonymizable for GDPR-style flows)
-- ---------------------------------------------------------------------------
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  type          text not null default 'person' check (type in ('person', 'company')),
  full_name     text not null,
  company       text,
  email         citext,
  phone         text,
  address       text,
  city          text,
  tags          text[] not null default '{}',
  status        public.client_status not null default 'active',
  source        text,
  notes         text,
  anonymized_at timestamptz,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- bookings — the core scheduling entity
-- ---------------------------------------------------------------------------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  type          public.booking_type not null default 'standard',
  title         text not null,
  category_id   uuid not null references public.categories (id),
  room_id       uuid references public.rooms (id),
  client_id     uuid references public.clients (id),
  created_by    uuid not null references public.profiles (id),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  constraint bookings_ends_after_starts check (ends_at > starts_at),
  status        public.booking_status not null default 'confirmed',
  price         numeric(10, 2) check (price >= 0),
  notes         text,
  color_override text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- formations — 1:1 extension of bookings with type = 'formation'
-- ---------------------------------------------------------------------------
create table public.formations (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  capacity    int not null check (capacity > 0),
  description text,
  price_label numeric(10, 2) check (price_label >= 0),
  status      public.formation_status not null default 'draft'
);

-- ---------------------------------------------------------------------------
-- formation_participants — enrolment / attendance
-- ---------------------------------------------------------------------------
create table public.formation_participants (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.formations (booking_id) on delete cascade,
  full_name    text not null,
  email        citext,
  phone        text,
  company      text,
  client_id    uuid references public.clients (id),
  status       public.participant_status not null default 'enrolled',
  waitlist     boolean not null default false,
  enrolled_at  timestamptz not null default now(),
  checked_in_at timestamptz,
  notes        text
);

-- ---------------------------------------------------------------------------
-- plans — strategic plans / initiatives with task breakdown
-- ---------------------------------------------------------------------------
create table public.plans (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  owner_id            uuid references public.profiles (id),
  status              public.plan_status not null default 'planning',
  priority            public.plan_priority not null default 'medium',
  start_date          date,
  target_date         date,
  progress            int not null default 0 check (progress between 0 and 100),
  target_date_marker  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- plan_tasks — tasks under a plan (progress rolls up to plans.progress)
-- ---------------------------------------------------------------------------
create table public.plan_tasks (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.plans (id) on delete cascade,
  title        text not null,
  assignee_id  uuid references public.profiles (id),
  due_date     date,
  status       public.task_status not null default 'todo',
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- change_requests — raised when a booking collides with another; assigned to
-- the other booking's owner for resolution (approve / decline / reschedule)
-- ---------------------------------------------------------------------------
create table public.change_requests (
  id                   uuid primary key default gen_random_uuid(),
  new_booking_id       uuid not null references public.bookings (id) on delete cascade,
  conflicting_booking_id uuid not null references public.bookings (id) on delete cascade,
  requested_by         uuid not null references public.profiles (id),
  assigned_to          uuid not null references public.profiles (id),
  message              text,
  suggested_slots      jsonb not null default '[]',
  status               public.request_status not null default 'pending',
  response_message     text,
  resolved_booking_id  uuid references public.bookings (id),
  created_at           timestamptz not null default now(),
  responded_at         timestamptz,
  expires_at           timestamptz not null default (now() + interval '72 hours')
);

-- ---------------------------------------------------------------------------
-- notifications — per-user in-app notifications (written via security definer)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null default '',
  link       text,
  entity_id  uuid,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log — append-only audit trail; actor_id intentionally NOT a hard FK
-- so the log survives profile deletion; writes happen via security definer
-- functions / service role only
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity_type text,
  entity_id   text,
  meta        jsonb not null default '{}',
  ip          inet,
  created_at  timestamptz not null default now()
);
