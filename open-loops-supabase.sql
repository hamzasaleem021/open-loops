-- ──────────────────────────────────────────────────────────────────────────
-- Open Loops – Supabase schema
-- One row per loop (not one row per user). Run this in the Supabase SQL
-- editor before enabling sync.
-- ──────────────────────────────────────────────────────────────────────────

-- ── LOOPS TABLE ──────────────────────────────────────────────────────────
create table if not exists public.loops (
  id            text        primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  raw_text      text        not null default '',
  kind          text        check (kind in ('do','decide','ask','schedule','let_go')),
  status        text        not null default 'active'
                              check (status in ('active','waiting','released','inbox')),
  prompt_answer text        not null default '',
  position      double precision not null default extract(epoch from now()),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz,
  deleted_at    timestamptz
);

-- Add completed_at to existing deployments (idempotent)
alter table public.loops add column if not exists completed_at timestamptz;

-- Add position to existing deployments. Backfill from created_at (epoch
-- seconds) so existing rows preserve their current display order — newer
-- loops get larger positions, matching "insert at top" in the client.
alter table public.loops add column if not exists position double precision;
update public.loops
   set position = extract(epoch from created_at)
 where position is null;
alter table public.loops alter column position set not null;
alter table public.loops alter column position set default extract(epoch from now());

-- Wake times and loop details (idempotent; safe to run again).
--   wake_at  — when a parked loop comes back to Up next on its own
--   details  — small facts about how a loop is moving or how it ended:
--              { sentAt, nudges, steps, decision, outcome, origin }
-- Run this before deploying the app version that adds wake-ups. Until it
-- runs, that app version still syncs everything else and keeps wake times
-- on the device.
alter table public.loops add column if not exists wake_at timestamptz;
alter table public.loops add column if not exists details jsonb not null default '{}'::jsonb;

-- Fast per-user queries
create index if not exists loops_user_id_idx         on public.loops (user_id);
create index if not exists loops_user_deleted_idx    on public.loops (user_id, deleted_at);
-- Fast ordered pulls (user's live rows, newest position first)
create index if not exists loops_user_position_idx   on public.loops (user_id, position desc)
  where deleted_at is null;
-- Parked loops by wake time (for wake-ups and, later, reminders)
create index if not exists loops_user_wake_idx       on public.loops (user_id, wake_at)
  where deleted_at is null and status = 'waiting' and wake_at is not null;

-- Auto-bump updated_at on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists loops_set_updated_at on public.loops;
create trigger loops_set_updated_at
  before update on public.loops
  for each row execute function public.set_updated_at();

-- ── ROW-LEVEL SECURITY ───────────────────────────────────────────────────
alter table public.loops enable row level security;

grant usage  on schema public to authenticated;
grant select, insert, update on table public.loops to authenticated;
revoke all   on table public.loops from anon;

-- Older setups also have underscored copies of these rules
-- (users_read_own_loops etc.). They repeat the rules below and make Postgres
-- check everything twice, so remove them.
drop policy if exists users_read_own_loops   on public.loops;
drop policy if exists users_insert_own_loops on public.loops;
drop policy if exists users_update_own_loops on public.loops;

-- (select auth.uid()) is looked up once per query instead of once per row.
-- The rules only apply to signed-in users; anon has no access at all.
drop policy if exists "users read own loops"   on public.loops;
create policy "users read own loops"
  on public.loops for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own loops" on public.loops;
create policy "users insert own loops"
  on public.loops for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own loops" on public.loops;
create policy "users update own loops"
  on public.loops for update
  to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── BATCH UPSERT (used when seeding server from local data) ──────────────
-- p_loops is a JSON array whose items use camelCase keys to match the JS
-- client: { id, rawText, kind, status, promptAnswer, position, createdAt,
-- wakeAt, details }.
-- Every inserted row is stamped with auth.uid() as user_id regardless of
-- what the payload contains, so a caller cannot impersonate another user.
-- RLS on public.loops blocks updates to rows owned by a different user, so
-- on-conflict updates against someone else's id silently no-op (they're
-- filtered by the UPDATE policy, not this function body).
--
-- On conflict we restore the row (deleted_at = null) so that seeding from
-- a local cache reliably resurrects rows that were soft-deleted on the
-- server. Callers should only invoke this when they've verified the
-- server is genuinely uninitialized (count = 0).
create or replace function public.batch_upsert_loops(p_loops jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(p_loops)
  loop
    insert into public.loops
      (id, user_id, raw_text, kind, status, prompt_answer, position, created_at, wake_at, details)
    values (
      item->>'id',
      auth.uid(),
      coalesce(item->>'rawText', ''),
      nullif(item->>'kind', ''),
      coalesce(nullif(item->>'status', ''), 'active'),
      coalesce(item->>'promptAnswer', ''),
      coalesce((item->>'position')::double precision,
               extract(epoch from coalesce((item->>'createdAt')::timestamptz, now()))),
      coalesce((item->>'createdAt')::timestamptz, now()),
      nullif(item->>'wakeAt', '')::timestamptz,
      case when jsonb_typeof(item->'details') = 'object' then item->'details' else '{}'::jsonb end
    )
    on conflict (id) do update
      set raw_text      = excluded.raw_text,
          kind          = excluded.kind,
          status        = excluded.status,
          prompt_answer = excluded.prompt_answer,
          position      = excluded.position,
          wake_at       = excluded.wake_at,
          details       = excluded.details,
          deleted_at    = null,
          updated_at    = now();
  end loop;
end;
$$;

grant execute on function public.batch_upsert_loops(jsonb) to authenticated;
revoke all   on function public.batch_upsert_loops(jsonb) from anon;

-- ── NUDGES (web push) ────────────────────────────────────────────────────
-- One row per phone or browser that said yes to nudges. The "push" Edge
-- Function (supabase/functions/push) reads these, decides what to say, and
-- sends two kinds of nudge: one the moment a parked loop wakes up, and a
-- check-in at the time each phone picked (only when there's something to say,
-- at most one a day). All of it fits the free plan.
create table if not exists public.push_subscriptions (
  endpoint        text primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh          text not null,
  auth            text not null,
  tz              text not null default 'UTC',
  nudge_time      time not null default '09:00',
  voice           text not null default 'cheeky',   -- unused since version 20 (one voice); kept for older apps
  wakeups         boolean not null default true,
  stale           boolean not null default true,
  recap           boolean not null default true,
  last_run_on     date,          -- the day the last check-in ran (the sender's own record)
  last_run_at     timestamptz,
  quiet_on        date,          -- set by the app: no check-in on this day (a time picked after it passed)
  wake_checked_at timestamptz not null default now(),  -- wake-ups are sent for loops that woke after this
  last_stale_at   timestamptz,
  recent_lines    text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint push_voice_valid      check (voice in ('cheeky', 'plain')),
  constraint push_endpoint_https   check (endpoint like 'https://%')
);
-- Upgrading from version 19: any time of day, and the newer bookkeeping.
alter table public.push_subscriptions drop constraint if exists push_nudge_time_range;
alter table public.push_subscriptions add column if not exists last_run_at timestamptz;
alter table public.push_subscriptions add column if not exists quiet_on date;
alter table public.push_subscriptions add column if not exists wake_checked_at timestamptz not null default now();
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
-- Woken loops by user and time (parked ones, and ones the app already woke).
create index if not exists loops_user_woke_idx on public.loops (user_id, wake_at)
  where deleted_at is null and wake_at is not null and status in ('waiting', 'active');

-- Unknown time zones fall back to UTC instead of breaking the schedule.
create or replace function public.push_subscriptions_clean_tz()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.tz) then
    new.tz := 'UTC';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists push_subscriptions_clean_tz on public.push_subscriptions;
create trigger push_subscriptions_clean_tz
  before insert or update on public.push_subscriptions
  for each row execute function public.push_subscriptions_clean_tz();

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon;
revoke truncate, references, trigger on table public.push_subscriptions from authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists "users read own push subscriptions"   on public.push_subscriptions;
drop policy if exists "users add own push subscriptions"    on public.push_subscriptions;
drop policy if exists "users update own push subscriptions" on public.push_subscriptions;
drop policy if exists "users remove own push subscriptions" on public.push_subscriptions;
create policy "users read own push subscriptions" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "users add own push subscriptions" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own push subscriptions" on public.push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users remove own push subscriptions" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- The sender runs as service_role: it reads loops to decide what a nudge
-- says, applies Done / Tomorrow, and keeps its own bookkeeping.
grant select, update on table public.loops to service_role;
grant select, update, delete on table public.push_subscriptions to service_role;

-- Check-ins: phones whose time came in the last 3 hours (a missed run still
-- goes out), in their own time zone, that haven't had that day's check-in.
-- A 23:00 check-in sent after midnight still counts for the day it belonged
-- to, so there's never a second one. Only the recap and stale checks ride on
-- it; wake-ups have their own nudge.
create or replace function public.push_due_subscriptions()
returns table (
  endpoint text, user_id uuid, p256dh text, auth text, tz text, voice text,
  wakeups boolean, stale boolean, recap boolean, last_stale_at timestamptz,
  recent_lines text[], local_date date, local_dow int
)
language sql stable set search_path = '' as $$
  with s as (
    select p.endpoint as s_endpoint, p.user_id as s_user, p.p256dh as s_p256dh, p.auth as s_auth,
           p.tz as s_tz, p.voice as s_voice, p.wakeups as s_wakeups, p.stale as s_stale,
           p.recap as s_recap, p.last_stale_at as s_last_stale, p.recent_lines as s_recent,
           p.last_run_on as s_last_run_on, p.quiet_on as s_quiet_on,
           (now() at time zone p.tz) as s_local_now,
           mod((floor(extract(epoch from ((now() at time zone p.tz)::time - p.nudge_time)) / 60))::int + 1440, 1440) as s_since
      from public.push_subscriptions p
     where p.stale or p.recap
  ), slot as (
    select s.*, (s.s_local_now - make_interval(mins => s.s_since))::date as s_slot_date
      from s
     where s.s_since < 180
  )
  select slot.s_endpoint, slot.s_user, slot.s_p256dh, slot.s_auth, slot.s_tz, slot.s_voice,
         slot.s_wakeups, slot.s_stale, slot.s_recap, slot.s_last_stale, slot.s_recent,
         slot.s_slot_date, extract(dow from slot.s_slot_date)::int
    from slot
   where (slot.s_last_run_on is null or slot.s_last_run_on < slot.s_slot_date)
     and (slot.s_quiet_on is null or slot.s_quiet_on < slot.s_slot_date)
$$;

-- Wake-ups: phones with at least one loop that woke since their last check
-- (looking back two hours at most, so switching wake-ups back on never
-- replays a backlog). checked_to is the cut-off the sender saves afterwards.
create or replace function public.push_due_wakeups()
returns table (
  endpoint text, user_id uuid, p256dh text, auth text, tz text,
  recent_lines text[], checked_from timestamptz, checked_to timestamptz
)
language sql stable set search_path = '' as $$
  select s.endpoint, s.user_id, s.p256dh, s.auth, s.tz, s.recent_lines,
         greatest(s.wake_checked_at, now() - interval '2 hours'), now()
    from public.push_subscriptions s
   where s.wakeups
     and exists (
       select 1 from public.loops l
        where l.user_id = s.user_id
          and l.deleted_at is null
          and l.status in ('waiting', 'active')
          and l.wake_at is not null
          and l.wake_at > greatest(s.wake_checked_at, now() - interval '2 hours')
          and l.wake_at <= now()
     )
$$;

-- Done / Tomorrow from a notification button.
create or replace function public.push_apply_action(p_user uuid, p_loop text, p_action text, p_tz text)
returns boolean
language plpgsql set search_path = '' as $$
declare
  v_tz text := coalesce((select name from pg_catalog.pg_timezone_names where name = p_tz limit 1), 'UTC');
  v_rows int;
begin
  if p_action = 'done' then
    update public.loops
       set status = 'released',
           completed_at = now(),
           details = coalesce(details, '{}'::jsonb)
                     || jsonb_build_object('outcome', case when kind = 'let_go' then 'let_go' else 'done' end)
     where id = p_loop and user_id = p_user and deleted_at is null and status <> 'released';
  elsif p_action = 'tomorrow' then
    update public.loops
       set status = 'waiting',
           wake_at = (((now() at time zone v_tz)::date + 1) + time '09:00') at time zone v_tz
     where id = p_loop and user_id = p_user and deleted_at is null and status <> 'released';
  else
    return false;
  end if;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- The sender's keys, read from Vault (see README → Nudges).
create or replace function public.push_config()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
    from vault.decrypted_secrets
   where name in ('open_loops_cron_secret', 'open_loops_vapid_public',
                  'open_loops_vapid_private', 'open_loops_action_secret');
$$;

-- Only the sender (service role) may call these.
revoke all on function public.push_due_subscriptions() from public, anon, authenticated;
revoke all on function public.push_due_wakeups() from public, anon, authenticated;
revoke all on function public.push_apply_action(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_due_subscriptions() to service_role;
grant execute on function public.push_due_wakeups() to service_role;
grant execute on function public.push_apply_action(uuid, text, text, text) to service_role;
grant execute on function public.push_config() to service_role;

-- The schedule: every minute, inside Postgres. It only calls the sender when
-- a loop just woke or a phone's check-in time came, so calls stay rare (a
-- handful per phone per day, against the free plan's 500,000 a month).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'open-loops-push',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'open_loops_push_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'open_loops_cron_secret')
    ),
    body := '{"job":"run"}'::jsonb,
    timeout_milliseconds := 30000
  )
  where exists (select 1 from public.push_due_wakeups())
     or exists (select 1 from public.push_due_subscriptions());
  $job$
);
-- Keep the scheduler's own log small (it writes a row per run).
select cron.schedule(
  'open-loops-cron-cleanup',
  '23 3 * * *',
  $job$ delete from cron.job_run_details where end_time < now() - interval '2 days' $job$
);

-- ── SCHEDULE NUDGES (version 28) ────────────────────────────────────────
-- A Schedule loop nudges at its time: the app sets wake_at to details.at, so
-- the wake-up above is the nudge. Versions before 27 saved the time with no
-- wake_at (those loops never nudged), and version 27 set it 30 minutes
-- early. This moves both to the time itself, for loops still ahead. It only
-- changes the wake time (where each loop waits is left alone) and leaves any
-- other wake time alone, so running the file again changes nothing.
update public.loops
   set wake_at = (details->>'at')::timestamptz
 where deleted_at is null
   and kind = 'schedule'
   and status in ('active', 'waiting')
   and case when (details->>'at') ~ '^\d{4}-\d{2}-\d{2}T'
            then (details->>'at')::timestamptz > now()
                 and (wake_at is null
                      or wake_at = (details->>'at')::timestamptz - interval '30 minutes')
            else false end;

-- ── REALTIME ─────────────────────────────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.loops;
  exception
    when duplicate_object then null;
  end;
end;
$$;
