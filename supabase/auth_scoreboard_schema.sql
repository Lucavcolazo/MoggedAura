-- Tablas base para login + aura + scoreboard.
-- Ejecutar este script en Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique not null,
  aura_points integer not null default 1200,
  best_psl numeric(4,1) not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_aura_idx on public.profiles(aura_points desc);

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_public" on public.profiles;
create policy "profiles_read_public"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
begin
  base_username := split_part(new.email, '@', 1);
  if base_username is null or length(base_username) = 0 then
    base_username := 'player';
  end if;

  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    left(base_username, 20) || '_' || right(new.id::text, 6)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();
