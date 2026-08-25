-- RLS policies for Milestone 1 application tables.
-- Version-controlled and applied together with Drizzle migrations.
-- Supabase owns auth.users; these policies reference auth.uid().

-- Foreign keys to the Supabase auth schema (not managed by Drizzle).
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

alter table public.organization_members
  add constraint organization_members_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

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
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- organizations: visible to members; any authenticated user can create one.
create policy "organizations_select_member"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "organizations_insert_authenticated"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "organizations_update_member"
  on public.organizations for update
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

-- organization_members: a user can see membership rows of their own orgs.
create policy "organization_members_select_own_orgs"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- A user may insert their own membership row (used when creating an org).
create policy "organization_members_insert_self"
  on public.organization_members for insert
  with check (user_id = auth.uid());
