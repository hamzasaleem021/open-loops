-- Open Loops Supabase schema
-- Matches the current frontend sync model in open-loops.html.

create extension if not exists pgcrypto;

create table if not exists public.loops (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null default '',
  kind text null check (kind in ('do', 'decide', 'ask', 'schedule', 'let_go')),
  status text not null default 'active' check (status in ('active', 'waiting', 'released', 'inbox')),
  prompt_answer text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists loops_user_created_idx
  on public.loops (user_id, created_at desc);

create index if not exists loops_user_deleted_idx
  on public.loops (user_id, deleted_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists loops_set_updated_at on public.loops;
create trigger loops_set_updated_at
before update on public.loops
for each row
execute function public.set_updated_at();

alter table public.loops enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.loops to authenticated;
revoke all on public.loops from anon;

drop policy if exists "users read own loops" on public.loops;
create policy "users read own loops"
on public.loops
for select
using (auth.uid() = user_id);

drop policy if exists "users insert own loops" on public.loops;
create policy "users insert own loops"
on public.loops
for insert
with check (auth.uid() = user_id);

drop policy if exists "users update own loops" on public.loops;
create policy "users update own loops"
on public.loops
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.batch_upsert_loops(p_loops jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.loops (
    id,
    user_id,
    raw_text,
    kind,
    status,
    prompt_answer,
    created_at
  )
  select
    coalesce(item->>'id', gen_random_uuid()::text),
    v_user_id,
    coalesce(item->>'rawText', ''),
    case
      when item ? 'kind' and item->>'kind' in ('do', 'decide', 'ask', 'schedule', 'let_go')
        then item->>'kind'
      else null
    end,
    case
      when item ? 'status' and item->>'status' in ('active', 'waiting', 'released', 'inbox')
        then item->>'status'
      else 'active'
    end,
    coalesce(item->>'promptAnswer', ''),
    coalesce((item->>'createdAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_loops, '[]'::jsonb)) as item
  on conflict (id) do update
    set raw_text = excluded.raw_text,
        kind = excluded.kind,
        status = excluded.status,
        prompt_answer = excluded.prompt_answer,
        created_at = excluded.created_at
  where public.loops.user_id = v_user_id;
end;
$$;

grant execute on function public.batch_upsert_loops(jsonb) to authenticated;
revoke all on function public.batch_upsert_loops(jsonb) from anon;

do $$
begin
  begin
    alter publication supabase_realtime add table public.loops;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;
