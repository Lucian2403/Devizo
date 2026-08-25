-- RLS for customers. Access is limited to members of the owning organization.
-- Note: there is no DELETE policy on purpose. Customers are never hard-deleted
-- through the app; they are archived by setting archived_at instead.
-- This file is written to be safe to run more than once.

alter table public.customers enable row level security;

drop policy if exists "customers_select_member" on public.customers;
create policy "customers_select_member"
  on public.customers for select
  using (public.is_org_member(organization_id));

drop policy if exists "customers_insert_member" on public.customers;
create policy "customers_insert_member"
  on public.customers for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "customers_update_member" on public.customers;
create policy "customers_update_member"
  on public.customers for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
