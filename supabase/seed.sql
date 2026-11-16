-- seed.sql: CALENDAR. DEMO DATA (staging / local ONLY)
-- =======================================================
-- NEVER run this file against production. It inserts fake demo content
-- (rooms, clients, bookings, formations, plans/tasks) clearly labelled DEMO.
--
-- Prerequisites:
--   1. Migrations 0001..0005 applied  (system categories, working hours and
--      business_settings already come from migration 0003: they are NOT
--      repeated here on purpose).
--   2. At least one admin profile exists (run scripts/create-admin.mjs first).
--
-- Notes:
--   * All demo entities are labelled "DEMO" so they can be found and purged.
--   * This script is NOT idempotent: re-running it duplicates the demo data.
--     To reset a staging/local database, run 0001..0005 fresh, or delete rows
--     whose title/name contains 'DEMO' (rooms carry '(DEMO)' in their name).
--   * Demo booking #11 (Grande, +5d 15:00–17:00) deliberately overlaps demo
--     booking #6 (Grande, +5d 14:00–16:00) and is inserted as
--     status = 'pending_conflict' to exercise the change-request flow.
--   * Demo formation "Excel avancé" is seeded at capacity 2 with 2 active
--     participants, which makes the touch_formation_full() trigger flip it
--     to status 'full' automatically: verify formations.status afterwards.

do $$
declare
  v_admin          uuid;
  v_room_grande    uuid;
  v_room_petite    uuid;
  v_room_formation uuid;
  v_cat_meeting    uuid;
  v_cat_event      uuid;
  v_cat_formation  uuid;
  v_client1        uuid;
  v_client2        uuid;
  v_client3        uuid;
  v_client4        uuid;
  v_client5        uuid;
  v_booking_form1  uuid;
  v_booking_form2  uuid;
  v_plan1          uuid;
  v_plan2          uuid;
begin
  -- --- resolve the acting admin (demo rows are created by "the first admin")
  select p.id into v_admin
  from public.profiles p
  where p.role = 'admin' and p.is_active
  order by p.created_at asc
  limit 1;

  if v_admin is null then
    raise exception 'seed.sql: no active admin profile found · run scripts/create-admin.mjs first';
  end if;

  select c.id into v_cat_meeting   from public.categories c where c.name_en = 'Meeting Room Rental' limit 1;
  select c.id into v_cat_event     from public.categories c where c.name_en = 'Event' limit 1;
  select c.id into v_cat_formation from public.categories c where c.name_en = 'Formation' limit 1;

  if v_cat_meeting is null or v_cat_event is null or v_cat_formation is null then
    raise exception 'seed.sql: system categories missing · apply migration 0003 first';
  end if;

  -- =========================================================================
  -- DEMO rooms
  -- =========================================================================
  insert into public.rooms
    (name, location, capacity, hourly_rate, currency, amenities, sort, notes)
  values
    ('Salle Grande (DEMO)', 'Casablanca', 12, 450.00, 'MAD',
     array['projecteur', 'visioconférence', 'wifi', 'tableau blanc'], 1,
     'DEMO room · safe to delete')
  returning id into v_room_grande;

  insert into public.rooms
    (name, location, capacity, hourly_rate, currency, amenities, sort, notes)
  values
    ('Salle Petite (DEMO)', 'Agadir', 6, 250.00, 'MAD',
     array['wifi', 'écran'], 2,
     'DEMO room · safe to delete')
  returning id into v_room_petite;

  insert into public.rooms
    (name, location, capacity, hourly_rate, currency, amenities, sort, notes)
  values
    ('Salle Formation (DEMO)', 'Casablanca', 20, 600.00, 'MAD',
     array['projecteur', 'wifi', 'tableau blanc', 'ordinateurs', 'paperboard'], 3,
     'DEMO room · safe to delete')
  returning id into v_room_formation;

  -- =========================================================================
  -- DEMO clients (fake people / companies)
  -- =========================================================================
  insert into public.clients
    (type, full_name, company, email, phone, city, tags, status, source, notes, created_by)
  values
    ('company', 'DEMO · Atlas Logistics (SARL)', 'Atlas Logistics',
     'demo.atlas@example.com', '+212522000001', 'Casablanca',
     array['enterprise', 'logistics'], 'active', 'referral', 'DEMO data · safe to delete', v_admin)
  returning id into v_client1;

  insert into public.clients
    (type, full_name, company, email, phone, city, tags, status, source, notes, created_by)
  values
    ('company', 'DEMO · Nord Invest Capital', 'Nord Invest Capital',
     'demo.nordinvest@example.com', '+212522000002', 'Casablanca',
     array['finance', 'vip'], 'active', 'website', 'DEMO data · safe to delete', v_admin)
  returning id into v_client2;

  insert into public.clients
    (type, full_name, company, email, phone, city, tags, status, source, notes, created_by)
  values
    ('company', 'DEMO · CDG Alliance', 'CDG Alliance',
     'demo.cdg@example.com', '+212537000003', 'Rabat',
     array['enterprise'], 'active', 'referral', 'DEMO data · safe to delete', v_admin)
  returning id into v_client3;

  insert into public.clients
    (type, full_name, company, email, phone, city, tags, status, source, notes, created_by)
  values
    ('company', 'DEMO · Lumen Events', 'Lumen Events',
     'demo.lumen@example.com', '+212524000004', 'Marrakech',
     array['events'], 'lead', 'website', 'DEMO data · safe to delete', v_admin)
  returning id into v_client4;

  insert into public.clients
    (type, full_name, email, phone, city, tags, status, source, notes, created_by)
  values
    ('person', 'DEMO · Youssef Alaoui',
     'demo.youssef.alaoui@example.com', '+212611223344', 'Agadir',
     array['recruitment'], 'active', 'walk-in', 'DEMO data · safe to delete', v_admin)
  returning id into v_client5;

  -- =========================================================================
  -- DEMO bookings (12): 4 past completed, 7 future confirmed-ish, 1 pending conflict
  -- =========================================================================
  insert into public.bookings
    (type, title, category_id, room_id, client_id, created_by, starts_at, ends_at, status, price, notes)
  values
    ('standard', '[DEMO] Comité de direction · Atlas Logistics', v_cat_meeting, v_room_grande, v_client1, v_admin,
     date_trunc('day', now()) + interval '-20 days 10:00', date_trunc('day', now()) + interval '-20 days 12:00',
     'completed', 900.00, 'DEMO data · safe to delete'),
    ('standard', '[DEMO] Conférence partenaires · Nord Invest', v_cat_event, v_room_grande, v_client2, v_admin,
     date_trunc('day', now()) + interval '-12 days 15:00', date_trunc('day', now()) + interval '-12 days 18:00',
     'completed', 1800.00, 'DEMO data · safe to delete'),
    ('standard', '[DEMO] Entretien recrutement · backend', v_cat_meeting, v_room_petite, v_client5, v_admin,
     date_trunc('day', now()) + interval '-8 days 09:30', date_trunc('day', now()) + interval '-8 days 10:30',
     'completed', 250.00, 'DEMO data · safe to delete'),
    ('standard', '[DEMO] Revue de projet · CDG Alliance', v_cat_meeting, v_room_grande, v_client3, v_admin,
     date_trunc('day', now()) + interval '-6 days 14:00', date_trunc('day', now()) + interval '-6 days 16:00',
     'completed', 900.00, 'DEMO data · safe to delete'),
    ('standard', '[DEMO] Réunion stratégique · CDG Alliance', v_cat_meeting, v_room_grande, v_client3, v_admin,
     date_trunc('day', now()) + interval '3 days 09:00', date_trunc('day', now()) + interval '3 days 11:00',
     'confirmed', 900.00, 'DEMO data · safe to delete'),
    ('standard', '[DEMO] Présentation client · Nord Invest', v_cat_meeting, v_room_grande, v_client2, v_admin,
     date_trunc('day', now()) + interval '5 days 14:00', date_trunc('day', now()) + interval '5 days 16:00',
     'confirmed', 900.00, 'DEMO data · safe to delete'),
    ('standard', '[DEMO] Entretien RH · poste marketing', v_cat_meeting, v_room_petite, v_client5, v_admin,
     date_trunc('day', now()) + interval '2 days 10:00', date_trunc('day', now()) + interval '2 days 10:45',
     'confirmed', 250.00, 'DEMO data · safe to delete'),
    ('standard', '[DEMO] Cocktail de lancement produit', v_cat_event, v_room_grande, v_client4, v_admin,
     date_trunc('day', now()) + interval '8 days 18:30', date_trunc('day', now()) + interval '8 days 22:00',
     'confirmed', 2500.00, 'DEMO data · safe to delete'),
    ('formation', '[DEMO] Leadership Essentials · session novembre', v_cat_formation, v_room_grande, null, v_admin,
     date_trunc('day', now()) + interval '10 days 09:00', date_trunc('day', now()) + interval '10 days 17:00',
     'confirmed', 3500.00, 'DEMO data · safe to delete');

  insert into public.bookings
    (type, title, category_id, room_id, client_id, created_by, starts_at, ends_at, status, price, notes)
  values
    ('formation', '[DEMO] Excel avancé · la pratique', v_cat_formation, v_room_formation, null, v_admin,
     date_trunc('day', now()) + interval '12 days 09:00', date_trunc('day', now()) + interval '12 days 13:00',
     'confirmed', 1800.00, 'DEMO data · safe to delete')
  returning id into v_booking_form2;

  select b.id into v_booking_form1
  from public.bookings b
  where b.title = '[DEMO] Leadership Essentials · session novembre';

  insert into public.bookings
    (type, title, category_id, room_id, client_id, created_by, starts_at, ends_at, status, price, notes)
  values
    ('standard', '[DEMO] Réunion budget · atelier (en attente)', v_cat_meeting, v_room_grande, v_client1, v_admin,
     date_trunc('day', now()) + interval '5 days 15:00', date_trunc('day', now()) + interval '5 days 17:00',
     'pending_conflict', 900.00, 'DEMO data · overlaps demo booking #6, awaiting change request flow'),
    ('standard', '[DEMO] Point d''équipe · annulé', v_cat_meeting, v_room_petite, v_client4, v_admin,
     date_trunc('day', now()) + interval '4 days 11:00', date_trunc('day', now()) + interval '4 days 12:00',
     'cancelled', 250.00, 'DEMO data · safe to delete');

  -- =========================================================================
  -- DEMO formations (2): linked to the two formation bookings above
  -- =========================================================================
  insert into public.formations (booking_id, capacity, description, price_label, status)
  values
    (v_booking_form1, 12,
     'DEMO · Formation leadership et gestion de projet (1 journée)', 3500.00, 'open');

  insert into public.formations (booking_id, capacity, description, price_label, status)
  values
    (v_booking_form2, 2,
     'DEMO · Excel pratico-pratique pour les équipes ops (demi-journée)', 1800.00, 'open');

  -- =========================================================================
  -- DEMO participants: form1: 5 active + 1 waitlist; form2: exactly full
  -- =========================================================================
  insert into public.formation_participants
    (booking_id, full_name, email, phone, company, client_id, status, waitlist)
  values
    (v_booking_form1, 'DEMO · Participant un', 'demo.participant1@example.com', '+212600000001', 'Atlas Logistics', v_client1, 'enrolled', false),
    (v_booking_form1, 'DEMO · Participant deux', 'demo.participant2@example.com', '+212600000002', 'Nord Invest Capital', v_client2, 'confirmed', false),
    (v_booking_form1, 'DEMO · Participant trois', 'demo.participant3@example.com', '+212600000003', 'CDG Alliance', v_client3, 'enrolled', false),
    (v_booking_form1, 'DEMO · Participant quatre', 'demo.participant4@example.com', '+212600000004', 'Indépendant', null, 'enrolled', false),
    (v_booking_form1, 'DEMO · Participant cinq (waitlist)', 'demo.participant5@example.com', '+212600000005', 'Nord Invest Capital', null, 'enrolled', true),
    (v_booking_form1, 'DEMO · Participant six', 'demo.participant6@example.com', '+212600000006', 'Atlas Logistics', null, 'enrolled', false);

  insert into public.formation_participants
    (booking_id, full_name, email, phone, company, status, waitlist)
  values
    (v_booking_form2, 'DEMO · Participant sept', 'demo.participant7@example.com', '+212600000007', 'Atlas Logistics', 'enrolled', false),
    (v_booking_form2, 'DEMO · Participant huit', 'demo.participant8@example.com', '+212600000008', 'Nord Invest Capital', 'confirmed', false);
  -- touch_formation_full() flips v_booking_form2 from 'open' to 'full' here.

  -- =========================================================================
  -- DEMO plans (2) with tasks: progress rolls up automatically via trigger
  -- =========================================================================
  insert into public.plans
    (title, description, owner_id, status, priority, start_date, target_date, target_date_marker)
  values
    ('DEMO · Refonte du site web Eiden', 'DEMO plan · refonte complète de eiden-group.com',
     v_admin, 'active', 'high', current_date - 10, current_date + 30, true)
  returning id into v_plan1;

  insert into public.plan_tasks (plan_id, title, assignee_id, due_date, status, position, completed_at)
  values
    (v_plan1, 'DEMO · Maquettes validées (Figma)', v_admin, current_date - 5, 'done', 1, now()),
    (v_plan1, 'DEMO · Intégration page d''accueil', v_admin, current_date + 7, 'in_progress', 2, null),
    (v_plan1, 'DEMO · Contenus FR/EN', v_admin, current_date - 2, 'done', 3, now()),
    (v_plan1, 'DEMO · Recette + mise en ligne', v_admin, current_date + 25, 'todo', 4, null);
  -- trigger sets v_plan1.progress = 50 (2 of 4 done)

  insert into public.plans
    (title, description, owner_id, status, priority, start_date, target_date, target_date_marker)
  values
    ('DEMO · Expansion Agadir', 'DEMO plan · ouverture d''une salle à Agadir',
     v_admin, 'planning', 'medium', current_date, current_date + 90, false)
  returning id into v_plan2;

  insert into public.plan_tasks (plan_id, title, assignee_id, due_date, status, position, completed_at)
  values
    (v_plan2, 'DEMO · Étude de marché locale', v_admin, current_date - 1, 'done', 1, now()),
    (v_plan2, 'DEMO · Visite des locaux', v_admin, current_date + 14, 'todo', 2, null),
    (v_plan2, 'DEMO · Business plan chiffré', v_admin, current_date + 30, 'todo', 3, null);
  -- trigger sets v_plan2.progress = 33 (1 of 3 done)

  raise notice 'DEMO seed complete: 3 rooms, 5 clients, 12 bookings, 2 formations (6 + 2 participants), 2 plans (7 tasks)';
end
$$;
