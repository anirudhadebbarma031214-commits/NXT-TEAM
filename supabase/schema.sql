-- NXT TEAM Control Center schema
-- Run this file in Supabase SQL Editor for project xocizxszrqiexfxculsa.
-- Admin authorization uses trusted app_metadata, never user_metadata.

create extension if not exists pgcrypto;

create table if not exists public.nxt_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'Web',
  url text not null default '',
  source_url text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nxt_collab_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  collaboration_type text not null default 'Other',
  message text not null,
  status text not null default 'new' check (status in ('new','reviewing','accepted','declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.nxt_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nxt_site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.nxt_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nxt_projects_status_idx on public.nxt_projects(status);
create index if not exists nxt_collab_status_idx on public.nxt_collab_requests(status);
create index if not exists nxt_collab_created_idx on public.nxt_collab_requests(created_at desc);
create index if not exists nxt_activity_created_idx on public.nxt_activity_logs(created_at desc);

alter table public.nxt_projects enable row level security;
alter table public.nxt_collab_requests enable row level security;
alter table public.nxt_announcements enable row level security;
alter table public.nxt_site_settings enable row level security;
alter table public.nxt_activity_logs enable row level security;

-- New projects on Supabase may not be exposed to the Data API automatically.
grant select, insert, update, delete on public.nxt_projects to anon, authenticated;
grant select, insert, update, delete on public.nxt_collab_requests to anon, authenticated;
grant select, insert, update, delete on public.nxt_announcements to anon, authenticated;
grant select, insert, update, delete on public.nxt_site_settings to authenticated;
grant select, insert on public.nxt_activity_logs to authenticated;

-- Public site can display published projects and active announcements.
drop policy if exists "Public can read published projects" on public.nxt_projects;
create policy "Public can read published projects" on public.nxt_projects
for select to anon, authenticated using (status = 'published');

drop policy if exists "Admins manage projects" on public.nxt_projects;
create policy "Admins manage projects" on public.nxt_projects
for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can submit collaboration requests" on public.nxt_collab_requests;
create policy "Public can submit collaboration requests" on public.nxt_collab_requests
for insert to anon, authenticated
with check (
  length(trim(name)) between 1 and 100
  and length(trim(email)) between 3 and 254
  and length(trim(message)) between 5 and 5000
);

drop policy if exists "Admins manage collaboration requests" on public.nxt_collab_requests;
create policy "Admins manage collaboration requests" on public.nxt_collab_requests
for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can read active announcements" on public.nxt_announcements;
create policy "Public can read active announcements" on public.nxt_announcements
for select to anon, authenticated using (active = true);

drop policy if exists "Admins manage announcements" on public.nxt_announcements;
create policy "Admins manage announcements" on public.nxt_announcements
for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins manage site settings" on public.nxt_site_settings;
create policy "Admins manage site settings" on public.nxt_site_settings
for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins read activity logs" on public.nxt_activity_logs;
create policy "Admins read activity logs" on public.nxt_activity_logs
for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins write activity logs" on public.nxt_activity_logs;
create policy "Admins write activity logs" on public.nxt_activity_logs
for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Bootstrap exactly one administrator after creating that user in
-- Supabase Dashboard > Authentication > Users. Replace the email below,
-- uncomment, and run separately:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where email = 'YOUR-ADMIN-EMAIL@example.com';

