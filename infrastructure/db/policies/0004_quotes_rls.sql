-- RLS for quotes, quote versions and quote items (Milestone 4).
-- Access is limited to members of the owning organization via is_org_member().
-- Quotes are edited in place while a version is a draft; no DELETE policies are
-- added here (rows are managed through the app, not hard-deleted by users).
-- This file is written to be safe to run more than once.

alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_items enable row level security;

-- quotes
drop policy if exists "quotes_select_member" on public.quotes;
create policy "quotes_select_member"
  on public.quotes for select
  using (public.is_org_member(organization_id));

drop policy if exists "quotes_insert_member" on public.quotes;
create policy "quotes_insert_member"
  on public.quotes for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "quotes_update_member" on public.quotes;
create policy "quotes_update_member"
  on public.quotes for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- quote_versions
drop policy if exists "quote_versions_select_member" on public.quote_versions;
create policy "quote_versions_select_member"
  on public.quote_versions for select
  using (public.is_org_member(organization_id));

drop policy if exists "quote_versions_insert_member" on public.quote_versions;
create policy "quote_versions_insert_member"
  on public.quote_versions for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "quote_versions_update_member" on public.quote_versions;
create policy "quote_versions_update_member"
  on public.quote_versions for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- quote_items
-- Items are fully rewritten when a draft is saved, so members can also delete
-- their organization's item rows (scoped by is_org_member).
drop policy if exists "quote_items_select_member" on public.quote_items;
create policy "quote_items_select_member"
  on public.quote_items for select
  using (public.is_org_member(organization_id));

drop policy if exists "quote_items_insert_member" on public.quote_items;
create policy "quote_items_insert_member"
  on public.quote_items for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "quote_items_update_member" on public.quote_items;
create policy "quote_items_update_member"
  on public.quote_items for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "quote_items_delete_member" on public.quote_items;
create policy "quote_items_delete_member"
  on public.quote_items for delete
  using (public.is_org_member(organization_id));
