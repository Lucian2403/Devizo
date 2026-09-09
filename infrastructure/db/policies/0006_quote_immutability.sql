-- Database-level immutability guard for frozen quote versions (M6.1).
--
-- The application already refuses to edit non-draft versions, but this trigger
-- is a hard safety net against accidental direct writes: once a quote_version
-- leaves 'draft' it can never be edited again, and its items can never be
-- inserted, updated or deleted. The ONLY permitted transition is draft -> a
-- terminal status, plus updating a version that is still a draft.
--
-- This file is written to be safe to run more than once.

-- 1) quote_versions: block any UPDATE whose OLD row is already frozen.
--    A draft may still be edited or transitioned; a frozen version is locked.
create or replace function public.enforce_quote_version_immutability()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Quote version % is % and cannot be deleted.',
        old.id, old.status;
    end if;
    return old;
  end if;

  -- UPDATE
  if old.status <> 'draft' then
    raise exception 'Quote version % is % and is immutable.',
      old.id, old.status;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists quote_versions_immutability on public.quote_versions;
create trigger quote_versions_immutability
  before update or delete on public.quote_versions
  for each row execute function public.enforce_quote_version_immutability();

-- 2) quote_items: block INSERT/UPDATE/DELETE when the parent version is frozen.
--    Draft versions are fully rewritten on save, so those writes stay allowed.
create or replace function public.enforce_quote_item_immutability()
returns trigger as $$
declare
  parent_status text;
  parent_id uuid;
begin
  parent_id := coalesce(new.quote_version_id, old.quote_version_id);
  select status into parent_status
  from public.quote_versions
  where id = parent_id;

  -- If the parent no longer exists (cascade delete), allow the operation.
  if parent_status is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if parent_status <> 'draft' then
    raise exception 'Quote items of version % are immutable (status %).',
      parent_id, parent_status;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists quote_items_immutability on public.quote_items;
create trigger quote_items_immutability
  before insert or update or delete on public.quote_items
  for each row execute function public.enforce_quote_item_immutability();

-- 3) audit_events: append-only. Block any UPDATE or DELETE.
create or replace function public.enforce_audit_events_append_only()
returns trigger as $$
begin
  raise exception 'audit_events is append-only; % is not allowed.', tg_op;
end;
$$ language plpgsql;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.enforce_audit_events_append_only();

-- 4) audit_events RLS: members of the owning organization may read and append.
--    No update/delete policies exist (append-only is also enforced above).
alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select_member" on public.audit_events;
create policy "audit_events_select_member"
  on public.audit_events for select
  using (public.is_org_member(organization_id));

drop policy if exists "audit_events_insert_member" on public.audit_events;
create policy "audit_events_insert_member"
  on public.audit_events for insert
  with check (public.is_org_member(organization_id));

