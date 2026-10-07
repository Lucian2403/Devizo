BEGIN;

CREATE FUNCTION pg_temp.expect_failure(statement text, expected_state text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  actual_state text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
    IF actual_state = expected_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected SQLSTATE %, got % for %', expected_state, actual_state, statement;
  END;
  RAISE EXCEPTION 'Expected rejection for %', statement;
END
$$;

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  source_a uuid := gen_random_uuid();
  source_b uuid := gen_random_uuid();
  source_foreign uuid := gen_random_uuid();
  update_a uuid := gen_random_uuid();
  update_foreign uuid := gen_random_uuid();
  update_member uuid := gen_random_uuid();
  norm_id uuid := gen_random_uuid();
  resource_id uuid := gen_random_uuid();
  version_id uuid;
  draft_id uuid;
  consumption_id uuid;
  status text;
  column_name text;
  review_sql text;
  relation_sql text;
  applicability_sql text;
  consumption_sql text;
  snapshot_sql text;
  record_count int;
BEGIN
  INSERT INTO auth.users (id) VALUES (actor), (outsider);
  INSERT INTO public.organizations (id, name, slug)
    VALUES (org_a, 'Governance test A', org_a::text), (org_b, 'Governance test B', org_b::text);
  INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_a, actor, 'owner'), (org_b, outsider, 'owner');
  INSERT INTO public.normative_sources
    (id, organization_id, code, title, edition, source_type, publisher, jurisdiction,
     authority, source_uri, content_fingerprint, official_status)
    VALUES
    (source_a, org_a, 'TEST-A', 'Original title', '2026', 'normative_document',
     'Original publisher', 'MD', 'Original authority', 'https://example.test/a', 'original-fingerprint', 'in_force'),
    (source_b, org_a, 'TEST-B', 'Other title', '2025', 'normative_document',
     null, 'MD', null, null, null, 'unknown'),
    (source_foreign, org_b, 'TEST-C', 'Foreign title', '2026', 'normative_document',
     null, 'MD', null, null, null, 'in_force');
  INSERT INTO public.normative_updates
    (id, organization_id, source_id, title, event_fingerprint)
    VALUES (update_a, org_a, source_a, 'Test signal', 'changed'),
           (update_member, org_a, source_a, 'Member review signal', 'member-change'),
           (update_foreign, org_b, source_foreign, 'Foreign signal', 'foreign');

  review_sql := format(
    'INSERT INTO public.normative_update_reviews
     (organization_id, update_id, source_id, reviewer_user_id, decision, source_code, source_edition, detected_fingerprint)
     VALUES (%L,%L,%L,%L,''reviewed_no_action'',''TEST-A'',''2026'',''changed'')',
    org_a, update_a, source_a, actor);
  relation_sql := format(
    'INSERT INTO public.normative_source_relations
     (organization_id, from_source_id, to_source_id, created_by_user_id, relation_type)
     VALUES (%L,%L,%L,%L,''related_to'')',
    org_a, source_a, source_b, actor);
  applicability_sql := format(
    'INSERT INTO public.normative_applicability_decisions
     (organization_id, source_id, revision, decision, decided_by_user_id, basis_note,
      source_code, source_edition, source_title, source_publisher, source_jurisdiction,
      source_authority, source_uri, source_fingerprint, official_status)
     VALUES (%L,%L,1,''unknown'',%L,''Test decision'',''TEST-A'',''2026'',
      ''Original title'',''Original publisher'',''MD'',''Original authority'',
      ''https://example.test/a'',''original-fingerprint'',''in_force'')',
    org_a, source_a, actor);

  -- Each actor is validated even when the connection bypasses RLS.
  PERFORM pg_temp.expect_failure(replace(review_sql, actor::text, outsider::text), '23514');
  PERFORM pg_temp.expect_failure(replace(relation_sql, actor::text, outsider::text), '23514');
  PERFORM pg_temp.expect_failure(replace(applicability_sql, actor::text, outsider::text), '23514');
  PERFORM pg_temp.expect_failure(replace(review_sql, update_a::text, update_foreign::text), '23514');
  PERFORM pg_temp.expect_failure(replace(relation_sql, source_b::text, source_foreign::text), '23503');
  PERFORM pg_temp.expect_failure(replace(applicability_sql, source_a::text, source_foreign::text), '23503');

  -- Every provenance field is null-safely checked, not just official status.
  FOREACH column_name IN ARRAY ARRAY[
    'source_code', 'source_edition', 'source_title', 'source_publisher',
    'source_jurisdiction', 'source_authority', 'source_uri', 'source_fingerprint', 'official_status'
  ] LOOP
    snapshot_sql := format(
      'INSERT INTO public.normative_applicability_decisions
       SELECT (jsonb_populate_record(NULL::public.normative_applicability_decisions,
         jsonb_build_object(''id'', gen_random_uuid(), ''organization_id'', %L,
           ''source_id'', %L, ''revision'', 1, ''decision'', ''unknown'',
           ''decided_by_user_id'', %L, ''decided_at'', now(), ''basis_note'', ''Test'',
           ''source_code'', ''TEST-A'', ''source_edition'', ''2026'',
           ''source_title'', ''Original title'', ''source_publisher'', ''Original publisher'',
           ''source_jurisdiction'', ''MD'', ''source_authority'', ''Original authority'',
           ''source_uri'', ''https://example.test/a'', ''source_fingerprint'', ''original-fingerprint'',
           ''official_status'', ''in_force'') || jsonb_build_object(%L, NULL))).*',
      org_a, source_a, actor, column_name);
    PERFORM pg_temp.expect_failure(snapshot_sql, '23514');
    PERFORM pg_temp.expect_failure(replace(
      snapshot_sql, format('jsonb_build_object(%L, NULL)', column_name),
      format('jsonb_build_object(%L, ''forged-value'')', column_name)), '23514');
  END LOOP;
  EXECUTE review_sql;
  EXECUTE relation_sql;
  EXECUTE applicability_sql;
  PERFORM pg_temp.expect_failure(applicability_sql, '23505');
  EXECUTE replace(applicability_sql, ',1,', ',2,');
  SELECT count(*) INTO record_count FROM public.normative_applicability_decisions WHERE source_id = source_a;
  IF record_count <> 2 THEN RAISE EXCEPTION 'Applicability revisions not preserved'; END IF;

  -- Existing snapshots survive live metadata edits.
  UPDATE public.normative_sources SET title = 'Changed title', edition = '2027',
    publisher = 'Changed publisher', jurisdiction = 'RO', authority = 'Changed authority',
    source_uri = 'https://example.test/changed', content_fingerprint = 'changed-fingerprint',
    official_status = 'superseded', code = 'CHANGED-A' WHERE id = source_a;
  IF EXISTS (
    SELECT 1 FROM public.normative_applicability_decisions WHERE source_id = source_a
      AND (source_code <> 'TEST-A' OR source_edition <> '2026' OR source_title <> 'Original title'
        OR source_publisher <> 'Original publisher' OR source_jurisdiction <> 'MD'
        OR source_authority <> 'Original authority' OR source_uri <> 'https://example.test/a'
        OR source_fingerprint <> 'original-fingerprint' OR official_status <> 'in_force')
  ) THEN RAISE EXCEPTION 'Historical provenance was rewritten'; END IF;

  -- Membership removal followed by account deletion cannot erase/block audit history.
  DELETE FROM public.organization_members WHERE organization_id = org_a AND user_id = actor;
  DELETE FROM auth.users WHERE id = actor;
  IF (SELECT count(*) FROM public.normative_update_reviews WHERE reviewer_user_id = actor) <> 1
     OR (SELECT count(*) FROM public.normative_source_relations WHERE created_by_user_id = actor) <> 1
     OR (SELECT count(*) FROM public.normative_applicability_decisions WHERE decided_by_user_id = actor) <> 2 THEN
    RAISE EXCEPTION 'Actor history did not survive membership/account deletion';
  END IF;
  FOREACH status IN ARRAY ARRAY['normative_update_reviews', 'normative_applicability_decisions', 'normative_source_relations'] LOOP
    PERFORM pg_temp.expect_failure(format('UPDATE public.%I SET organization_id = organization_id WHERE organization_id = %L', status, org_a), '55000');
    PERFORM pg_temp.expect_failure(format('DELETE FROM public.%I WHERE organization_id = %L', status, org_a), '55000');
  END LOOP;

  INSERT INTO public.estimate_norms (id, organization_id, code, name)
    VALUES (norm_id, org_a, 'TEST-NORM', 'Test norm');
  INSERT INTO public.professional_resources (id, organization_id, source_id, name, resource_type, unit)
    VALUES (resource_id, org_a, source_a, 'Test resource', 'labor', 'h');
  INSERT INTO public.estimate_norm_versions (organization_id, estimate_norm_id, source_id, version_label, basis_unit)
    VALUES (org_a, norm_id, source_a, 'draft-target', 'm2') RETURNING id INTO draft_id;
  FOREACH status IN ARRAY ARRAY['draft', 'in_review', 'approved', 'published'] LOOP
    INSERT INTO public.estimate_norm_versions (organization_id, estimate_norm_id, source_id, version_label, basis_unit)
      VALUES (org_a, norm_id, source_a, status, 'm2') RETURNING id INTO version_id;
    consumption_sql := format(
      'INSERT INTO public.resource_consumptions (organization_id, estimate_norm_version_id, resource_id, position_number, quantity_per_norm_basis)
       VALUES (%L,%L,%L,2,1)', org_a, version_id, resource_id);
    INSERT INTO public.resource_consumptions
      (organization_id, estimate_norm_version_id, resource_id, position_number, quantity_per_norm_basis)
      VALUES (org_a, version_id, resource_id, 1, 1) RETURNING id INTO consumption_id;
    IF status <> 'draft' THEN
      UPDATE public.estimate_norm_versions SET publication_status = 'in_review' WHERE id = version_id;
    END IF;
    IF status IN ('approved', 'published') THEN
      UPDATE public.estimate_norm_versions SET publication_status = 'approved' WHERE id = version_id;
    END IF;
    IF status = 'published' THEN
      UPDATE public.estimate_norm_versions SET publication_status = 'published' WHERE id = version_id;
    END IF;
    IF status = 'draft' THEN
      EXECUTE consumption_sql;
      UPDATE public.resource_consumptions SET quantity_per_norm_basis = 2 WHERE id = consumption_id;
      DELETE FROM public.resource_consumptions WHERE id = consumption_id;
    ELSE
      PERFORM pg_temp.expect_failure(consumption_sql, '55000');
      PERFORM pg_temp.expect_failure(format('UPDATE public.resource_consumptions SET quantity_per_norm_basis = 2 WHERE id = %L', consumption_id), '55000');
      PERFORM pg_temp.expect_failure(format('DELETE FROM public.resource_consumptions WHERE id = %L', consumption_id), '55000');
      PERFORM pg_temp.expect_failure(format('UPDATE public.resource_consumptions SET estimate_norm_version_id = %L WHERE id = %L', draft_id, consumption_id), '55000');
      IF status = 'approved' THEN
        UPDATE public.estimate_norm_versions SET publication_status = 'in_review' WHERE id = version_id;
        UPDATE public.estimate_norm_versions SET publication_status = 'draft' WHERE id = version_id;
        UPDATE public.resource_consumptions SET quantity_per_norm_basis = 3 WHERE id = consumption_id;
      END IF;
    END IF;
  END LOOP;
  -- A draft consumption cannot be moved INTO a frozen parent either.
  PERFORM pg_temp.expect_failure(format(
    'UPDATE public.resource_consumptions SET estimate_norm_version_id = %L WHERE estimate_norm_version_id = %L',
    version_id, (SELECT id FROM public.estimate_norm_versions WHERE estimate_norm_id = norm_id AND version_label = 'draft')), '55000');

  -- Catalog checks complement real RLS access checks below.
  FOREACH status IN ARRAY ARRAY['normative_update_reviews', 'normative_applicability_decisions', 'normative_source_relations'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || status)::regclass) THEN
      RAISE EXCEPTION 'RLS missing for %', status;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = status AND cmd IN ('UPDATE','DELETE','ALL')) THEN
      RAISE EXCEPTION 'Mutable RLS policy on %', status;
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = status AND cmd IN ('SELECT','INSERT')) <> 2 THEN
      RAISE EXCEPTION 'Member SELECT/INSERT policies missing for %', status;
    END IF;
  END LOOP;

  -- Keep fixture IDs available while exercising a non-owner, non-bypass role.
  PERFORM set_config('devizo.test_org', org_a::text, true);
  PERFORM set_config('devizo.test_source', source_a::text, true);
  PERFORM set_config('devizo.test_other_source', source_b::text, true);
  PERFORM set_config('devizo.test_foreign_source', source_foreign::text, true);
  PERFORM set_config('devizo.test_update', update_member::text, true);
  PERFORM set_config('devizo.test_outsider', outsider::text, true);
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (org_a, outsider, 'owner');
END
$$;

CREATE ROLE devizo_normative_guard_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_normative_guard_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO devizo_normative_guard_test;
GRANT EXECUTE ON FUNCTION auth.uid() TO devizo_normative_guard_test;
DO $$
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO devizo_normative_guard_test',
    (SELECT nspname FROM pg_namespace WHERE oid = pg_my_temp_schema()));
END
$$;
SET LOCAL ROLE devizo_normative_guard_test;
SELECT set_config('request.jwt.claim.sub', current_setting('devizo.test_outsider'), true);

DO $$
DECLARE
  org_id uuid := current_setting('devizo.test_org')::uuid;
  source_id uuid := current_setting('devizo.test_source')::uuid;
  actor_id uuid := current_setting('devizo.test_outsider')::uuid;
  affected int;
BEGIN
  IF (SELECT count(*) FROM public.normative_applicability_decisions WHERE organization_id = org_id) <> 2 THEN
    RAISE EXCEPTION 'Member SELECT denied';
  END IF;
  INSERT INTO public.normative_applicability_decisions
    (organization_id, source_id, revision, decision, decided_by_user_id, basis_note,
     source_code, source_edition, source_title, source_publisher, source_jurisdiction,
     source_authority, source_uri, source_fingerprint, official_status)
    SELECT org_id, id, 3, 'deferred', actor_id, 'RLS member decision',
      code, edition, title, publisher, jurisdiction, authority, source_uri, content_fingerprint, official_status
    FROM public.normative_sources WHERE id = source_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Member INSERT denied'; END IF;
  INSERT INTO public.normative_update_reviews
    (organization_id, update_id, source_id, reviewer_user_id, decision, source_code, source_edition, detected_fingerprint)
    VALUES (org_id, current_setting('devizo.test_update')::uuid, source_id, actor_id,
      'reviewed_no_action', 'CHANGED-A', '2027', 'member-change');
  INSERT INTO public.normative_source_relations
    (organization_id, from_source_id, to_source_id, relation_type, created_by_user_id)
    VALUES (org_id, source_id, current_setting('devizo.test_other_source')::uuid, 'supplements', actor_id);
  PERFORM pg_temp.expect_failure(format(
    'INSERT INTO public.normative_source_relations (organization_id, from_source_id, to_source_id, relation_type, created_by_user_id)
     VALUES (%L,%L,%L,''amends'',%L)', org_id, source_id,
    current_setting('devizo.test_other_source'), gen_random_uuid()), '23514');
  PERFORM pg_temp.expect_failure(format(
    'INSERT INTO public.normative_source_relations (organization_id, from_source_id, to_source_id, relation_type, created_by_user_id)
     VALUES (%L,%L,%L,''supplements'',%L)', org_id, source_id, current_setting('devizo.test_foreign_source'), actor_id), '23503');
  UPDATE public.normative_applicability_decisions SET basis_note = 'Forbidden' WHERE organization_id = org_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'RLS allowed UPDATE'; END IF;
  DELETE FROM public.normative_applicability_decisions WHERE organization_id = org_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'RLS allowed DELETE'; END IF;
END
$$;

-- A user without membership cannot see or create organization history.
SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.normative_applicability_decisions)
     OR EXISTS (SELECT 1 FROM public.normative_update_reviews)
     OR EXISTS (SELECT 1 FROM public.normative_source_relations) THEN
    RAISE EXCEPTION 'Nonmember can read governance history';
  END IF;
  PERFORM pg_temp.expect_failure(format(
    'INSERT INTO public.normative_source_relations (organization_id, from_source_id, to_source_id, relation_type, created_by_user_id)
     VALUES (%L,%L,%L,''amends'',%L)',
    current_setting('devizo.test_org'), current_setting('devizo.test_source'),
    current_setting('devizo.test_other_source'), auth.uid()), '23514');
END
$$;
RESET ROLE;
ROLLBACK;
