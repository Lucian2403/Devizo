-- RLS for the AI catalog-match feedback log (Milestone 5.1).
-- Access is limited to members of the owning organization via is_org_member().
-- Only SELECT and INSERT are exposed: corrections are append-only raw data and
-- are never edited or deleted through the app.
-- This file is written to be safe to run more than once.

alter table public.catalog_match_feedback enable row level security;

drop policy if exists "catalog_match_feedback_select_member" on public.catalog_match_feedback;
create policy "catalog_match_feedback_select_member"
  on public.catalog_match_feedback for select
  using (public.is_org_member(organization_id));

drop policy if exists "catalog_match_feedback_insert_member" on public.catalog_match_feedback;
create policy "catalog_match_feedback_insert_member"
  on public.catalog_match_feedback for insert
  with check (public.is_org_member(organization_id));
