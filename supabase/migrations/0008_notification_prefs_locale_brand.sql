-- ===========================================================================
-- 0008: business_settings: notification prefs + localization defaults
--        storage: brand-assets bucket (public read, admin write) for logos
--
-- 1) notification_prefs jsonb: which transactional emails actually leave the
--    building. Enforced in lib/email/notify.ts before every sendMail; default
--    all-on so existing behavior is unchanged.
-- 2) hour_cycle / date_format: business-wide rendering defaults, persisted
--    from Settings → Localization (24h + DD/MM/YYYY, the Casablanca norm).
-- 3) brand-assets storage bucket: public read (logo is public-facing),
--    admin-only write. Logo upload path for Settings → General.
-- ===========================================================================

alter table public.business_settings
  add column if not exists notification_prefs jsonb not null default '{"booking_created":true,"booking_updated":true,"booking_cancelled":true,"formation_reminder":true,"change_request_received":true,"change_request_approved":true,"change_request_declined":true,"change_request_expired":true,"welcome":true}'::jsonb,
  add column if not exists hour_cycle text not null default '24' check (hour_cycle in ('24','12')),
  add column if not exists date_format text not null default 'eu' check (date_format in ('eu','us'));

-- ---------------------------------------------------------------------------
-- brand-assets bucket + storage RLS
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

drop policy if exists brand_assets_read on storage.objects;
create policy brand_assets_read
  on storage.objects for select
  to public
  using (bucket_id = 'brand-assets');

drop policy if exists brand_assets_admin_insert on storage.objects;
create policy brand_assets_admin_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'brand-assets' and public.is_admin());

drop policy if exists brand_assets_admin_update on storage.objects;
create policy brand_assets_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'brand-assets' and public.is_admin())
  with check (bucket_id = 'brand-assets' and public.is_admin());

drop policy if exists brand_assets_admin_delete on storage.objects;
create policy brand_assets_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'brand-assets' and public.is_admin());
