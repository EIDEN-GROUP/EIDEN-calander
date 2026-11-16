-- ===========================================================================
-- 0007: log_audit_event(): canonical security-definer write path for audit_log.
--
-- audit_log has NO insert policy for `authenticated` (writes are security-definer
-- only: see 0005_rls.sql). Until now the only definer writer was
-- expire_change_requests(), so any audit insert made through the regular
-- authenticated client was rejected by RLS: and since supabase-js returns
-- errors instead of throwing, those writes vanished silently. This function is
-- the single write path for server actions going forward; actor_id is taken
-- from auth.uid() (null under service-role / cron contexts, matching the
-- expire_change_requests convention).
-- ===========================================================================

create or replace function public.log_audit_event(
  p_action      text,
  p_entity_type text default null,
  p_entity_id   text default null,
  p_meta        jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_action is null or btrim(p_action) = '' then
    raise exception 'log_audit_event: p_action must not be empty';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, meta)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_audit_event(text, text, text, jsonb) from public, anon;
grant execute on function public.log_audit_event(text, text, text, jsonb) to authenticated, service_role;
