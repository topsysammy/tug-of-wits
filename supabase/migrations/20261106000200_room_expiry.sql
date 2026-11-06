-- Expire rooms after 30 minutes without activity (PRD: "rooms expire after 30 min idle").
-- The Edge Function also refuses expired rooms on access, so this job is just cleanup.
-- If pg_cron isn't available on your plan, enable it under Database → Extensions first.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'tug-of-wits-expire-rooms',
  '*/5 * * * *',
  $$ delete from public.rooms where last_activity < now() - interval '30 minutes' $$
);
