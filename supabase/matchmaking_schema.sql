-- Esquema base para matchmaking público.
-- Nota: este MVP usa políticas abiertas para role anon.
-- En producción, mover a auth obligatoria y políticas por usuario autenticado.

create extension if not exists pgcrypto;

create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  username text not null,
  aura integer not null default 1200,
  status text not null default 'waiting',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matchmaking_queue_status_idx on public.matchmaking_queue(status, joined_at);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  player_a_client_id text not null,
  player_b_client_id text not null,
  status text not null default 'pending',
  winner_client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_status_idx on public.matches(status, created_at);

alter table public.matchmaking_queue enable row level security;
alter table public.matches enable row level security;

drop policy if exists "queue_select_anon" on public.matchmaking_queue;
create policy "queue_select_anon"
on public.matchmaking_queue
for select
to anon
using (true);

drop policy if exists "queue_insert_anon" on public.matchmaking_queue;
create policy "queue_insert_anon"
on public.matchmaking_queue
for insert
to anon
with check (status in ('waiting', 'matched', 'left'));

drop policy if exists "queue_update_anon" on public.matchmaking_queue;
create policy "queue_update_anon"
on public.matchmaking_queue
for update
to anon
using (true)
with check (status in ('waiting', 'matched', 'left'));

drop policy if exists "matches_select_anon" on public.matches;
create policy "matches_select_anon"
on public.matches
for select
to anon
using (true);

drop policy if exists "matches_insert_anon" on public.matches;
create policy "matches_insert_anon"
on public.matches
for insert
to anon
with check (status in ('pending', 'active', 'finished', 'cancelled'));

drop policy if exists "matches_update_anon" on public.matches;
create policy "matches_update_anon"
on public.matches
for update
to anon
using (true)
with check (status in ('pending', 'active', 'finished', 'cancelled'));
