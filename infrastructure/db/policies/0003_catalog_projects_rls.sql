-- RLS for projects and the price catalog (Milestone 3).
-- Access is limited to members of the owning organization via is_org_member().
-- No DELETE policies: projects are archived (archived_at) and catalog items are
-- deactivated (active = false); rows are never hard-deleted through the app.
-- This file is written to be safe to run more than once.

alter table public.projects enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_items enable row level security;

-- projects
drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
  on public.projects for select
  using (public.is_org_member(organization_id));

drop policy if exists "projects_insert_member" on public.projects;
create policy "projects_insert_member"
  on public.projects for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "projects_update_member" on public.projects;
create policy "projects_update_member"
  on public.projects for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- catalog_categories
drop policy if exists "catalog_categories_select_member" on public.catalog_categories;
create policy "catalog_categories_select_member"
  on public.catalog_categories for select
  using (public.is_org_member(organization_id));

drop policy if exists "catalog_categories_insert_member" on public.catalog_categories;
create policy "catalog_categories_insert_member"
  on public.catalog_categories for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "catalog_categories_update_member" on public.catalog_categories;
create policy "catalog_categories_update_member"
  on public.catalog_categories for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- catalog_items
drop policy if exists "catalog_items_select_member" on public.catalog_items;
create policy "catalog_items_select_member"
  on public.catalog_items for select
  using (public.is_org_member(organization_id));

drop policy if exists "catalog_items_insert_member" on public.catalog_items;
create policy "catalog_items_insert_member"
  on public.catalog_items for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "catalog_items_update_member" on public.catalog_items;
create policy "catalog_items_update_member"
  on public.catalog_items for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
