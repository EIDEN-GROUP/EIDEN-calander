-- 0005_rls.sql
-- CALENDAR.: row level security + role/function privileges + realtime.
-- Model: shared workspace. Every authenticated user sees all data; writes are
-- scoped per table (see policies below). anon gets NOTHING (default deny).
-- service_role bypasses RLS entirely (Supabase default) and is the only role
-- used for privileged server-side jobs (admin user creation, cron endpoint).

-- ===========================================================================
-- 1) Enable RLS on EVERY table (default deny; policies below re-open)
-- ===========================================================================
alter table public.profiles                 enable row level security;
alter table public.business_settings        enable row level security;
alter table public.working_hours            enable row level security;
alter table public.categories               enable row level security;
alter table public.rooms                    enable row level security;
alter table public.clients                  enable row level security;
alter table public.bookings                 enable row level security;
alter table public.formations               enable row level security;
alter table public.formation_participants   enable row level security;
alter table public.plans                    enable row level security;
alter table public.plan_tasks               enable row level security;
alter table public.change_requests          enable row level security;
alter table public.notifications            enable row level security;
alter table public.audit_log                enable row level security;

-- ===========================================================================
-- 2) Table & sequence privileges: only authenticated + service_role
--    (RLS is the gate for authenticated; service_role bypasses RLS)
-- ===========================================================================
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to service_role;

-- notifications: users may update ONLY read_at (mark-as-read), nothing else
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- audit_log: read-only (admin-only, via RLS) for authenticated; writes only
-- via security definer functions / service role
revoke insert, update, delete on public.audit_log from authenticated;

-- Keep future tables/privileges aligned (applies to objects created by the
-- role that runs this migration)
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant usage, select on sequences to service_role;

-- ===========================================================================
-- 3) Function privileges (functions are EXECUTE-able by PUBLIC by default:
--    tighten the RPC-facing ones)
-- ===========================================================================
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.notify_user(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.notify_user(uuid, text, text, text, text, uuid) to authenticated, service_role;

revoke all on function public.expire_change_requests() from public, anon;
grant execute on function public.expire_change_requests() to authenticated, service_role;

-- internal helper: not callable by app roles at all
revoke all on function public._touch_formation_full(uuid) from public, anon, authenticated;
grant execute on function public._touch_formation_full(uuid) to service_role;

-- trigger functions cannot be invoked via RPC anyway (they must run as
-- triggers); leave their default PUBLIC execute grant in place.

-- ===========================================================================
-- 4) Policies
-- ===========================================================================

-- ---- profiles -------------------------------------------------------------
-- everyone reads all profiles (shared workspace); only admins create/full-edit.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

-- staff may update their OWN row but NOT their role, NOT deactivate themselves
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_active
  );

-- admins: full update of any row (incl. role / is_active / must_change_password)
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- no delete policy: profiles are never deletable through the app

-- ---- business_settings ----------------------------------------------------
drop policy if exists business_settings_select on public.business_settings;
create policy business_settings_select
  on public.business_settings for select
  to authenticated
  using (true);

drop policy if exists business_settings_insert_admin on public.business_settings;
create policy business_settings_insert_admin
  on public.business_settings for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists business_settings_update_admin on public.business_settings;
create policy business_settings_update_admin
  on public.business_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists business_settings_delete_admin on public.business_settings;
create policy business_settings_delete_admin
  on public.business_settings for delete
  to authenticated
  using (public.is_admin());

-- ---- working_hours --------------------------------------------------------
drop policy if exists working_hours_select on public.working_hours;
create policy working_hours_select
  on public.working_hours for select
  to authenticated
  using (true);

drop policy if exists working_hours_insert_admin on public.working_hours;
create policy working_hours_insert_admin
  on public.working_hours for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists working_hours_update_admin on public.working_hours;
create policy working_hours_update_admin
  on public.working_hours for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists working_hours_delete_admin on public.working_hours;
create policy working_hours_delete_admin
  on public.working_hours for delete
  to authenticated
  using (public.is_admin());

-- ---- categories -----------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select
  on public.categories for select
  to authenticated
  using (true);

drop policy if exists categories_insert_admin on public.categories;
create policy categories_insert_admin
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists categories_update_admin on public.categories;
create policy categories_update_admin
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists categories_delete_admin on public.categories;
create policy categories_delete_admin
  on public.categories for delete
  to authenticated
  using (public.is_admin());

-- ---- rooms ----------------------------------------------------------------
drop policy if exists rooms_select on public.rooms;
create policy rooms_select
  on public.rooms for select
  to authenticated
  using (true);

drop policy if exists rooms_insert_admin on public.rooms;
create policy rooms_insert_admin
  on public.rooms for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists rooms_update_admin on public.rooms;
create policy rooms_update_admin
  on public.rooms for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists rooms_delete_admin on public.rooms;
create policy rooms_delete_admin
  on public.rooms for delete
  to authenticated
  using (public.is_admin());

-- ---- clients ---------------------------------------------------------------
-- soft-delete pattern: rows with deleted_at set are invisible to the app;
-- hard DELETE is admin-only.
drop policy if exists clients_select on public.clients;
create policy clients_select
  on public.clients for select
  to authenticated
  using (deleted_at is null);

drop policy if exists clients_insert on public.clients;
create policy clients_insert
  on public.clients for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists clients_update on public.clients;
create policy clients_update
  on public.clients for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin
  on public.clients for delete
  to authenticated
  using (public.is_admin());

-- ---- bookings ---------------------------------------------------------------
drop policy if exists bookings_select on public.bookings;
create policy bookings_select
  on public.bookings for select
  to authenticated
  using (true);

drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert
  on public.bookings for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists bookings_update on public.bookings;
create policy bookings_update
  on public.bookings for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists bookings_delete_admin on public.bookings;
create policy bookings_delete_admin
  on public.bookings for delete
  to authenticated
  using (public.is_admin());

-- ---- formations -------------------------------------------------------------
-- Same ownership pattern as bookings, enforced through the parent booking.
drop policy if exists formations_select on public.formations;
create policy formations_select
  on public.formations for select
  to authenticated
  using (true);

drop policy if exists formations_insert on public.formations;
create policy formations_insert
  on public.formations for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.bookings b
      where b.id = formations.booking_id
        and (b.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists formations_update on public.formations;
create policy formations_update
  on public.formations for update
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = formations.booking_id
        and (b.created_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.bookings b
      where b.id = formations.booking_id
        and (b.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists formations_delete_admin on public.formations;
create policy formations_delete_admin
  on public.formations for delete
  to authenticated
  using (public.is_admin());

-- ---- formation_participants -------------------------------------------------
-- shared operations: every authenticated user manages enrolment/attendance
drop policy if exists formation_participants_select on public.formation_participants;
create policy formation_participants_select
  on public.formation_participants for select
  to authenticated
  using (true);

drop policy if exists formation_participants_insert on public.formation_participants;
create policy formation_participants_insert
  on public.formation_participants for insert
  to authenticated
  with check (true);

drop policy if exists formation_participants_update on public.formation_participants;
create policy formation_participants_update
  on public.formation_participants for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists formation_participants_delete on public.formation_participants;
create policy formation_participants_delete
  on public.formation_participants for delete
  to authenticated
  using (true);

-- ---- plans ------------------------------------------------------------------
drop policy if exists plans_select on public.plans;
create policy plans_select
  on public.plans for select
  to authenticated
  using (true);

drop policy if exists plans_insert on public.plans;
create policy plans_insert
  on public.plans for insert
  to authenticated
  with check (true);

drop policy if exists plans_update on public.plans;
create policy plans_update
  on public.plans for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists plans_delete_admin on public.plans;
create policy plans_delete_admin
  on public.plans for delete
  to authenticated
  using (public.is_admin());

-- ---- plan_tasks --------------------------------------------------------------
drop policy if exists plan_tasks_select on public.plan_tasks;
create policy plan_tasks_select
  on public.plan_tasks for select
  to authenticated
  using (true);

drop policy if exists plan_tasks_insert on public.plan_tasks;
create policy plan_tasks_insert
  on public.plan_tasks for insert
  to authenticated
  with check (true);

drop policy if exists plan_tasks_update on public.plan_tasks;
create policy plan_tasks_update
  on public.plan_tasks for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists plan_tasks_delete on public.plan_tasks;
create policy plan_tasks_delete
  on public.plan_tasks for delete
  to authenticated
  using (true);

-- ---- change_requests ----------------------------------------------------------
drop policy if exists change_requests_select on public.change_requests;
create policy change_requests_select
  on public.change_requests for select
  to authenticated
  using (requested_by = auth.uid() or assigned_to = auth.uid() or public.is_admin());

drop policy if exists change_requests_insert on public.change_requests;
create policy change_requests_insert
  on public.change_requests for insert
  to authenticated
  with check (requested_by = auth.uid());

-- assignee responds (approve/decline/reschedule); cannot reassign the request
drop policy if exists change_requests_update_assignee on public.change_requests;
create policy change_requests_update_assignee
  on public.change_requests for update
  to authenticated
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- requester may cancel their own request (and nothing else)
drop policy if exists change_requests_update_requester_cancel on public.change_requests;
create policy change_requests_update_requester_cancel
  on public.change_requests for update
  to authenticated
  using (requested_by = auth.uid())
  with check (requested_by = auth.uid() and status = 'cancelled');

drop policy if exists change_requests_update_admin on public.change_requests;
create policy change_requests_update_admin
  on public.change_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- notifications ------------------------------------------------------------
-- insert: NO policy: only via security definer (notify_user) / service role.
-- update: own rows only, and only the read_at column (column grant + policy).
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- ---- audit_log -----------------------------------------------------------------
-- read: admin only. insert/update/delete: NO policies for authenticated:
-- writes happen via security definer functions (e.g. expire_change_requests)
-- or the service role (bypasses RLS).
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- ===========================================================================
-- 5) Realtime: add notifications to the supabase_realtime publication when
--    it exists (Supabase). No-op on a plain Postgres database.
-- ===========================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when duplicate_object then
    null; -- already a member of the publication
end
$$;
