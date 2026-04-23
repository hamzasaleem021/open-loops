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
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Fast per-user queries
create index if not exists loops_user_id_idx       on public.loops (user_id);
create index if not exists loops_user_deleted_idx  on public.loops (user_id, deleted_at);

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

drop policy if exists "users read own loops"   on public.loops;
create policy "users read own loops"
  on public.loops for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own loops" on public.loops;
create policy "users insert own loops"
  on public.loops for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own loops" on public.loops;
create policy "users update own loops"
  on public.loops for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── BATCH UPSERT (used when seeding server from local data) ──────────────
-- p_loops is a JSON array whose items use camelCase keys to match the JS
-- client: { id, rawText, kind, status, promptAnswer, createdAt }
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
    -- Skip any row whose user_id doesn't match the calling user (safety net)
    insert into public.loops
      (id, user_id, raw_text, kind, status, prompt_answer, created_at)
    values (
      item->>'id',
      auth.uid(),
      coalesce(item->>'rawText', ''),
      nullif(item->>'kind', ''),
      coalesce(nullif(item->>'status', ''), 'active'),
      coalesce(item->>'promptAnswer', ''),
      coalesce((item->>'createdAt')::timestamptz, now())
    )
    on conflict (id) do update
      set raw_text      = excluded.raw_text,
          kind          = excluded.kind,
          status        = excluded.status,
          prompt_answer = excluded.prompt_answer,
          updated_at    = now()
    where public.loops.user_id = auth.uid();
  end loop;
end;
$$;

grant execute on function public.batch_upsert_loops(jsonb) to authenticated;
revoke all   on function public.batch_upsert_loops(jsonb) from anon;

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
