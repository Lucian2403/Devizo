-- Database-level immutability guard for quote versions.
--
-- Drafts are editable. Sending freezes the commercial document. After a version
-- is sent, the only permitted change is the lifecycle decision sent -> accepted
-- or sent -> rejected. That decision may change only status and updated_at;
-- prices, items, snapshots and every other document field stay immutable.
--
-- This file is written to be safe to run more than once.

-- 1) quote_versions: allow normal draft edits, draft -> sent, and a status-only
--    sent -> accepted/rejected decision. Everything else is blocked.
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

  -- Drafts may be edited in place and may only leave draft by becoming sent.
  if old.status = 'draft' then
    if new.status not in ('draft', 'sent') then
      raise exception 'Invalid quote version transition: % -> %.',
        old.status, new.status;
    end if;
    return new;
  end if;

  -- A sent document is frozen. Only its lifecycle status may move to one of
  -- the two customer decisions. updated_at may move with that status change.
  if old.status = 'sent' and new.status in ('accepted', 'rejected') then
    if (to_jsonb(new) - 'status' - 'updated_at') is distinct from
       (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception 'Quote version % is sent; only its lifecycle status may change.',
        old.id;
    end if;
    return new;
  end if;

  raise exception 'Quote version % is % and is immutable.',
    old.id, old.status;
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

