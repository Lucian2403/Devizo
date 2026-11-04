BEGIN;

DO $$
BEGIN
  IF to_regclass('public.professional_general_reserve_decisions') IS NULL THEN
    RAISE EXCEPTION 'Migration 0028 is missing';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class
      WHERE oid='public.professional_general_reserve_decisions'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'Reserve decisions must have organization member RLS';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='professional_general_reserve_decisions'
        AND policyname IN (
          'professional_general_reserve_select_member',
          'professional_general_reserve_insert_member',
          'professional_general_reserve_update_member'
        )) <> 3 THEN
    RAISE EXCEPTION 'Three reserve member policies must be installed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
      WHERE tablename='professional_general_reserve_decisions'
        AND schemaname='public' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'Reserve decisions must not permit DELETE';
  END IF;
END
$$;

CREATE TEMP TABLE reserve_fixture AS
SELECT org_id, actor_id,
  gen_random_uuid() AS general_id,
  gen_random_uuid() AS source_id,
  gen_random_uuid() AS applicability_id
FROM procurement_legacy_fixture;

INSERT INTO public.professional_general_estimates
  (id, organization_id, name, valuation_date, currency)
SELECT general_id, org_id, 'Reserve test estimate', '2026-10-15', 'MDL'
FROM reserve_fixture;

INSERT INTO public.normative_sources
  (id, organization_id, code, title, edition, source_type, jurisdiction,
   effective_date, valid_from, status, official_status, monitoring_enabled)
SELECT source_id, org_id, 'CP L.01.01-2012', 'Reserve fixture CP source',
  '2012','normative_document','MD', '2013-02-15','2013-02-15',
  'active','in_force',false
FROM reserve_fixture;

INSERT INTO public.normative_applicability_decisions
  (id, organization_id, source_id, revision, decision, applicable_from,
   decided_by_user_id, basis_note, source_code, source_edition,
   source_title, source_publisher, source_jurisdiction, source_authority,
   source_uri, source_fingerprint, official_status)
SELECT f.applicability_id, f.org_id, f.source_id, 1, 'applicable',
  '2013-02-15', f.actor_id, 'Reserve database regression',
  s.code, s.edition, s.title, s.publisher, s.jurisdiction,
  s.authority, s.source_uri, s.content_fingerprint, s.official_status
FROM reserve_fixture f
JOIN public.normative_sources s
  ON s.id=f.source_id AND s.organization_id=f.org_id;

INSERT INTO public.professional_general_reserve_decisions
  (organization_id, general_estimate_id, source_id, applicability_decision_id,
   category, basis_note)
SELECT org_id, general_id, source_id, applicability_id,
  'social', 'Confirmed from project fixture'
FROM reserve_fixture;

DO $$
DECLARE
  one_fixture record;
  other_fixture record;
  scratch_id uuid := gen_random_uuid();
BEGIN
  SELECT * INTO one_fixture FROM reserve_fixture ORDER BY org_id LIMIT 1;
  SELECT * INTO other_fixture FROM reserve_fixture
    WHERE org_id <> one_fixture.org_id LIMIT 1;

  INSERT INTO public.professional_general_estimates
    (id, organization_id, name, valuation_date, currency)
  VALUES (scratch_id, one_fixture.org_id, 'Scratch reserve estimate',
    '2026-10-15','MDL');

  BEGIN
    INSERT INTO public.professional_general_reserve_decisions
      (organization_id, general_estimate_id, source_id, applicability_decision_id,
       category, basis_note)
    VALUES (one_fixture.org_id, one_fixture.general_id,
      one_fixture.source_id, one_fixture.applicability_id,
      'production','Duplicate');
    RAISE EXCEPTION 'Reserve uniqueness check missing';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_reserve_decisions
      (organization_id, general_estimate_id, source_id, applicability_decision_id,
       category, basis_note)
    VALUES (one_fixture.org_id, scratch_id,
      one_fixture.source_id, one_fixture.applicability_id,
      'unknown','Bad category');
    RAISE EXCEPTION 'Reserve category CHECK missing';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_reserve_decisions
      (organization_id, general_estimate_id, source_id, applicability_decision_id,
       category, basis_note)
    VALUES (one_fixture.org_id, scratch_id,
      one_fixture.source_id, one_fixture.applicability_id,
      'social','   ');
    RAISE EXCEPTION 'Reserve note CHECK missing';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_reserve_decisions
      (organization_id, general_estimate_id, source_id, applicability_decision_id,
       category, basis_note)
    VALUES (one_fixture.org_id, scratch_id,
      other_fixture.source_id, other_fixture.applicability_id,
      'social','Foreign source');
    RAISE EXCEPTION 'Reserve source tenant FK missing';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_reserve_decisions
      (organization_id, general_estimate_id, source_id, applicability_decision_id,
       category, basis_note)
    VALUES (one_fixture.org_id, scratch_id,
      one_fixture.source_id, other_fixture.applicability_id,
      'social','Foreign applicability');
    RAISE EXCEPTION 'Reserve applicability composite FK missing';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_reserve_decisions
      (organization_id, general_estimate_id, source_id, applicability_decision_id,
       category, basis_note)
    VALUES (one_fixture.org_id, other_fixture.general_id,
      one_fixture.source_id, one_fixture.applicability_id,
      'social','Foreign estimate');
    RAISE EXCEPTION 'Reserve estimate tenant FK missing';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END
$$;

CREATE ROLE devizo_reserve_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_reserve_rls_test;
GRANT SELECT ON public.organization_members, reserve_fixture TO devizo_reserve_rls_test;
GRANT SELECT, INSERT, UPDATE ON public.professional_general_reserve_decisions
  TO devizo_reserve_rls_test;

SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM reserve_fixture ORDER BY org_id LIMIT 1;
SET LOCAL ROLE devizo_reserve_rls_test;

DO $$
DECLARE
  own_org uuid;
  other_org uuid;
  changed integer;
BEGIN
  SELECT org_id INTO own_org FROM reserve_fixture
    WHERE actor_id=auth.uid() LIMIT 1;
  SELECT org_id INTO other_org FROM reserve_fixture
    WHERE actor_id<>auth.uid() LIMIT 1;

  IF (SELECT count(*) FROM public.professional_general_reserve_decisions
      WHERE organization_id=own_org) <> 1 THEN
    RAISE EXCEPTION 'Member must see own reserve';
  END IF;
  IF EXISTS (SELECT 1 FROM public.professional_general_reserve_decisions
      WHERE organization_id=other_org) THEN
    RAISE EXCEPTION 'Other organizations reserve exposed';
  END IF;
  UPDATE public.professional_general_reserve_decisions
    SET category='production'
    WHERE organization_id=own_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Member cannot edit own reserve'; END IF;

  UPDATE public.professional_general_reserve_decisions
    SET category='production' WHERE organization_id=other_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Member edited foreign reserve'; END IF;

  IF has_table_privilege(current_user,
    'public.professional_general_reserve_decisions','DELETE') THEN
    RAISE EXCEPTION 'Member unexpectedly has DELETE permission';
  END IF;
END
$$;
RESET ROLE;
ROLLBACK;
