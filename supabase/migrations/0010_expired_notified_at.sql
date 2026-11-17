-- 0010 — expired_notified_at on change_requests.
-- Why: the hourly expiry sweep is moving off Vercel Hobby (which only allows
-- daily crons) into stock Postgres (pg_cron). The SQL sweep flips statuses and
-- writes in-app notifications but cannot send SMTP mail. The app route
-- /api/cron/expire-requests emails "change request expired" mails; stamping
-- expired_notified_at makes that email exactly-once, no matter which scheduler
-- (hourly pg_net call, daily Vercel cron, manual curl) ran the route.
alter table public.change_requests
  add column if not exists expired_notified_at timestamptz;

comment on column public.change_requests.expired_notified_at is
  'Set by /api/cron/expire-requests after the "expired" email was sent. NULL = email pending. Guards against duplicate expiry mails across schedulers.';
