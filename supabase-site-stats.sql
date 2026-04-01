-- Run once in Supabase → SQL Editor (enables real online + persisted visit counts on Vercel).
-- Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY

create table if not exists botclub_site_counter (
  id text primary key,
  total_visits bigint not null default 0
);

insert into botclub_site_counter (id, total_visits) values ('global', 0)
on conflict (id) do nothing;

create table if not exists botclub_site_presence (
  session_id text primary key,
  last_seen timestamptz not null default now()
);

create index if not exists botclub_site_presence_last_seen_idx
  on botclub_site_presence (last_seen desc);

create or replace function botclub_increment_site_visits()
returns bigint
language plpgsql
as $$
declare v bigint;
begin
  insert into botclub_site_counter (id, total_visits) values ('global', 1)
  on conflict (id) do update
  set total_visits = botclub_site_counter.total_visits + 1
  returning total_visits into v;
  return v;
end;
$$;
