-- RLS policies for Milestone 1 application tables.
-- Version-controlled and applied together with Drizzle migrations.
-- Supabase owns auth.users; these policies reference auth.uid().
-- This file is written to be safe to run more than once.

-- Foreign keys to the Supabase auth schema (not managed by Drizzle).
-- Only add them if they don't already exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'organization_members_user_id_fkey'
  ) then
    alter table public.organization_members
      add constraint organization_members_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

-- Helper: is the current user a member of the given organization?
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

-- Enable RLS.
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- profiles: a user can see and manage only their own profile row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- organizations: visible to members; any authenticated user can create one.
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  using (public.is_org_member(id));

drop policy if exists "organizations_insert_authenticated" on public.organizations;
create policy "organizations_insert_authenticated"
  on public.organizations for insert
  with check (auth.uid() is not null);

drop policy if exists "organizations_update_member" on public.organizations;
create policy "organizations_update_member"
  on public.organizations for update
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

-- organization_members: a user can see membership rows of their own orgs.
drop policy if exists "organization_members_select_own_orgs" on public.organization_members;
create policy "organization_members_select_own_orgs"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- A user may insert their own membership row (used when creating an org).
drop policy if exists "organization_members_insert_self" on public.organization_members;
create policy "organization_members_insert_self"
  on public.organization_members for insert
  with check (user_id = auth.uid());
