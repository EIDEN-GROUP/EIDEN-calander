-- 0004_functions.sql
-- CALENDAR.: functions and triggers.
-- Security model:
--   * trigger functions are SECURITY DEFINER with a fixed search_path so they
--     behave identically regardless of the calling role (RLS included).
--   * RPC-facing functions (is_admin, notify_user, expire_change_requests)
--     are granted to authenticated/service_role in 0005_rls.sql, never to anon.

-- ===========================================================================
-- set_updated_at(): generic BEFORE UPDATE trigger: stamps updated_at = now()
-- ===========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at
  before update on public.business_settings
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- is_admin(): true when the current auth user is an ACTIVE admin profile.
-- Used by RLS policies. SECURITY DEFINER so it can read profiles regardless
-- of the caller's own policies (and so policies never recurse into profiles).
-- ===========================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active
  );
$$;

-- ===========================================================================
-- guard_booking_overlap(): BEFORE INSERT OR UPDATE on bookings.
-- Rejects a CONFIRMED booking when another CONFIRMED booking for the same
-- room overlaps. Pending/cancelled bookings are exempt (they resolve through
-- change_requests). Self is ignored on UPDATE.
-- App can bypass deliberately with:  set local app.force = '1';  (service role
-- or SQL editor only). Any other value / unset = guard active.
-- ===========================================================================
create or replace function public.guard_booking_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed'
     and new.room_id is not null
     and current_setting('app.force', true) is distinct from '1' then
    if exists (
      select 1
      from public.bookings b
      where b.room_id = new.room_id
        and b.status = 'confirmed'
        and b.id <> new.id
        and new.starts_at < b.ends_at
        and new.ends_at > b.starts_at
    ) then
      raise exception 'room_conflict'
        using errcode = 'P0001',
              hint = 'Another confirmed booking already occupies this room in that window. Reschedule, or set app.force = ''1'' to override.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_guard_overlap on public.bookings;
create trigger bookings_guard_overlap
  before insert or update on public.bookings
  for each row execute function public.guard_booking_overlap();

-- ===========================================================================
-- recompute_plan_progress(): AFTER INSERT OR UPDATE OR DELETE on plan_tasks.
-- sets plans.progress = round(100 * done_tasks / total_tasks); 0 tasks -> 0.
-- SECURITY DEFINER: plan_tasks is shared operations data, so the roll-up must
-- not depend on the caller's rights to the parent plan row.
-- ===========================================================================
create or replace function public.recompute_plan_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_plan_id uuid;
  v_new_plan_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_plan_id := old.plan_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_plan_id := new.plan_id;
  end if;

  if v_old_plan_id is not null then
    update public.plans p
       set progress = coalesce((
             select case when count(*) = 0 then 0
                              else round(100.0 * count(*) filter (where t.status = 'done') / count(*))::int
                         end
               from public.plan_tasks t
              where t.plan_id = v_old_plan_id
           ), 0)
     where p.id = v_old_plan_id;
  end if;

  if v_new_plan_id is not null and v_new_plan_id is distinct from v_old_plan_id then
    update public.plans p
       set progress = coalesce((
             select case when count(*) = 0 then 0
                              else round(100.0 * count(*) filter (where t.status = 'done') / count(*))::int
                         end
               from public.plan_tasks t
              where t.plan_id = v_new_plan_id
           ), 0)
     where p.id = v_new_plan_id;
  end if;

  return null; -- AFTER trigger: return value ignored
end;
$$;

drop trigger if exists plan_tasks_recompute_progress on public.plan_tasks;
create trigger plan_tasks_recompute_progress
  after insert or update or delete on public.plan_tasks
  for each row execute function public.recompute_plan_progress();

-- ===========================================================================
-- touch_formation_full(): AFTER INSERT OR UPDATE OR DELETE on
-- formation_participants. Counts active, non-waitlist participants
-- (enrolled/confirmed) and flips formations.status between open and full.
-- Only draft/open -> full and full -> open transitions are automated; ongoing
-- or completed formations are never resurrected/overridden automatically.
-- ===========================================================================
create or replace function public._touch_formation_full(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_status   public.formation_status;
  v_active   integer;
begin
  select f.capacity, f.status
    into v_capacity, v_status
    from public.formations f
   where f.booking_id = p_booking_id;

  if not found then
    return; -- formation row not visible / already deleted
  end if;

  select count(*)
    into v_active
    from public.formation_participants p
   where p.booking_id = p_booking_id
     and p.status in ('enrolled', 'confirmed')
     and p.waitlist = false;

  if v_active >= v_capacity and v_status in ('draft', 'open') then
    update public.formations
       set status = 'full'
     where booking_id = p_booking_id;
  elsif v_active < v_capacity and v_status = 'full' then
    update public.formations
       set status = 'open'
     where booking_id = p_booking_id;
  end if;
end;
$$;

create or replace function public.touch_formation_full()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public._touch_formation_full(new.booking_id);
  elsif tg_op = 'DELETE' then
    perform public._touch_formation_full(old.booking_id);
  else -- UPDATE
    perform public._touch_formation_full(new.booking_id);
    if old.booking_id is distinct from new.booking_id then
      perform public._touch_formation_full(old.booking_id);
    end if;
  end if;
  return null; -- AFTER trigger: return value ignored
end;
$$;

drop trigger if exists formation_participants_touch_full on public.formation_participants;
create trigger formation_participants_touch_full
  after insert or update or delete on public.formation_participants
  for each row execute function public.touch_formation_full();

-- ===========================================================================
-- notify_user(): single canonical way to write notifications.
-- SECURITY DEFINER: notifications has NO insert policy for the authenticated
-- role; every notification is written through this function (or the service
-- role). revoked from anon in 0005_rls.sql.
-- ===========================================================================
create or replace function public.notify_user(
  p_user_id   uuid,
  p_type      text,
  p_title     text,
  p_body      text default '',
  p_link      text default null,
  p_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'notify_user: p_user_id must not be null';
  end if;

  insert into public.notifications (user_id, type, title, body, link, entity_id)
  values (p_user_id, p_type, p_title, coalesce(p_body, ''), p_link, p_entity_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- ===========================================================================
-- expire_change_requests(): marks stale pending change requests as expired,
-- cancels their linked (new) bookings and notifies the requester.
-- Called by an external scheduler (e.g. Vercel cron hitting an API route with
-- the service role key); no pg_cron dependency. Returns the number of
-- requests expired in this run. Idempotent: safe to call any number of times.
-- ===========================================================================
create or replace function public.expire_change_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req   record;
  v_count integer := 0;
begin
  for v_req in
    select cr.id, cr.new_booking_id, cr.requested_by
      from public.change_requests cr
     where cr.status = 'pending'
       and cr.expires_at < now()
     order by cr.expires_at
       for update skip locked
  loop
    update public.change_requests
       set status = 'expired',
           responded_at = now()
     where id = v_req.id
       and status = 'pending';

    if found then
      update public.bookings
         set status = 'cancelled'
       where id = v_req.new_booking_id
         and status <> 'cancelled';

      perform public.notify_user(
        v_req.requested_by,
        'change_request_expired',
        'Change request expired',
        'Your booking change request expired after 72 hours without a response. The requested booking was cancelled.',
        '/requests',
        v_req.id
      );

      insert into public.audit_log (actor_id, action, entity_type, entity_id, meta)
      values (
        null,
        'change_request_expired',
        'change_request',
        v_req.id::text,
        jsonb_build_object('new_booking_id', v_req.new_booking_id)
      );

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;
