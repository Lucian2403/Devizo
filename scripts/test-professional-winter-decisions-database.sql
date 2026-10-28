BEGIN;

-- Real PostgreSQL 16 regression for the isolated winter decision component.
DO $$
BEGIN
  IF to_regclass('public.professional_winter_decisions') IS NULL THEN
    RAISE EXCEPTION 'Migration 0027 was not applied';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.professional_winter_decisions'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'Winter decisions must have RLS enabled';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='professional_winter_decisions'
        AND policyname IN (
          'professional_winter_decisions_select_member',
          'professional_winter_decisions_insert_member',
          'professional_winter_decisions_update_member'
        )) <> 3 THEN
    RAISE EXCEPTION 'Winter decisions require all three member policies';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='professional_winter_decisions'
        AND cmd='DELETE') THEN
    RAISE EXCEPTION 'Winter decisions must not expose DELETE';
  END IF;
END
$$;

CREATE TEMP TABLE winter_decision_fixture AS
SELECT
  org_id, actor_id, object_id,
  gen_random_uuid() AS general_id,
  gen_random_uuid() AS source_id,
  gen_random_uuid() AS applicability_id,
  gen_random_uuid() AS rule_id
FROM procurement_legacy_fixture;

INSERT INTO public.professional_general_estimates
  (id, organization_id, name, valuation_date, currency)
SELECT general_id, org_id, 'Winter test general estimate', '2026-10-15', 'MDL'
FROM winter_decision_fixture;

INSERT INTO public.normative_sources
  (id, organization_id, code, title, edition, source_type, jurisdiction,
   effective_date, valid_from, status, official_status, monitoring_enabled)
SELECT source_id, org_id, 'NCM L.02.06-2012', 'Winter cost source fixture',
  '2012', 'normative_document', 'MD',
  '2013-02-15', '2013-02-15', 'active', 'in_force', false
FROM winter_decision_fixture;

INSERT INTO public.normative_applicability_decisions
  (id, organization_id, source_id, revision, decision, applicable_from,
   decided_by_user_id, basis_note, source_code, source_edition,
   source_title, source_publisher, source_jurisdiction, source_authority,
   source_uri, source_fingerprint, official_status)
SELECT f.applicability_id, f.org_id, f.source_id, 1, 'applicable',
  '2013-02-15', f.actor_id, 'Winter decisions database fixture',
  s.code, s.edition, s.title, s.publisher, s.jurisdiction,
  s.authority, s.source_uri, s.content_fingerprint, s.official_status
FROM winter_decision_fixture f
JOIN public.normative_sources s
  ON s.id=f.source_id AND s.organization_id=f.org_id;

INSERT INTO public.professional_general_rule_definitions
  (id, organization_id, source_id, applicability_decision_id, component,
   rule_code, group_code, group_label, name, value_type, value, valid_from,
   source_reference)
SELECT rule_id, org_id, source_id, applicability_id,
  'winter_conditions', '024', 'civil', 'Civil buildings',
  'Winter fixture', 'percent', 0.8, '2013-02-15',
  'NCM L.02.06-2012 Anexa A'
FROM winter_decision_fixture;

INSERT INTO public.professional_winter_decisions
  (organization_id, general_estimate_id, mode, rule_definition_id,
   period_kind, building_scope, classification)
SELECT org_id, general_id, 'normative_rate', rule_id,
  'annual_average', 'other', 'listed'
FROM winter_decision_fixture;

DO $$
DECLARE
  own_fixture record;
  foreign_fixture record;
  scratch_general uuid := gen_random_uuid();
BEGIN
  SELECT * INTO own_fixture FROM winter_decision_fixture ORDER BY org_id LIMIT 1;
  SELECT * INTO foreign_fixture FROM winter_decision_fixture
    WHERE org_id <> own_fixture.org_id LIMIT 1;

  INSERT INTO public.professional_general_estimates
    (id, organization_id, name, valuation_date, currency)
  VALUES (scratch_general, own_fixture.org_id, 'Scratch winter estimate', '2026-10-15','MDL');

  BEGIN
    INSERT INTO public.professional_winter_decisions
      (organization_id, general_estimate_id, mode, rule_definition_id,
       period_kind, building_scope, classification)
    VALUES (own_fixture.org_id, own_fixture.general_id, 'normative_rate',
      own_fixture.rule_id, 'annual_average', 'other', 'listed');
    RAISE EXCEPTION 'Expected one winter decision per estimate';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_winter_decisions
      (organization_id, general_estimate_id, mode,
       period_kind, building_scope, classification)
    VALUES (own_fixture.org_id, scratch_general,
      'normative_rate', 'annual_average', 'other', 'listed');
    RAISE EXCEPTION 'Expected missing winter rule CHECK failure';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_winter_decisions
      (organization_id, general_estimate_id, mode, rule_definition_id,
       period_kind, winter_days, building_scope, classification)
    VALUES (own_fixture.org_id, scratch_general, 'normative_rate',
      own_fixture.rule_id, 'annual_average', 10, 'other', 'listed');
    RAISE EXCEPTION 'Expected annual period CHECK failure';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_winter_decisions
      (organization_id, general_estimate_id, mode,
       rule_definition_id, exclusion_reason)
    VALUES (own_fixture.org_id, scratch_general, 'not_applicable',
      own_fixture.rule_id, 'heated_current_repair');
    RAISE EXCEPTION 'Expected exclusion cannot have a rule';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_winter_decisions
      (organization_id, general_estimate_id, mode, rule_definition_id,
       period_kind, building_scope, classification)
    VALUES (own_fixture.org_id, scratch_general, 'normative_rate',
      foreign_fixture.rule_id, 'annual_average', 'other', 'listed');
    RAISE EXCEPTION 'Expected cross-organization rule FK failure';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_winter_decisions
      (organization_id, general_estimate_id, mode, rule_definition_id,
       period_kind, building_scope, classification)
    VALUES (own_fixture.org_id, foreign_fixture.general_id, 'normative_rate',
      own_fixture.rule_id, 'annual_average', 'other', 'listed');
    RAISE EXCEPTION 'Expected cross-organization estimate FK failure';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  INSERT INTO public.professional_winter_decisions
    (organization_id, general_estimate_id, mode, rule_definition_id,
     period_kind, start_date, end_date, winter_days,
     project_reference, building_scope, classification)
  VALUES (own_fixture.org_id, scratch_general, 'normative_rate',
    own_fixture.rule_id, 'short_project', '2026-10-01', '2027-01-08',
    23, 'POS fixture', 'other', 'listed');
END
$$;

CREATE ROLE devizo_winter_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_winter_rls_test;
GRANT SELECT ON public.organization_members, winter_decision_fixture
  TO devizo_winter_rls_test;
GRANT SELECT, UPDATE, INSERT ON public.professional_winter_decisions
  TO devizo_winter_rls_test;

SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM winter_decision_fixture ORDER BY org_id LIMIT 1;
SET LOCAL ROLE devizo_winter_rls_test;
DO $$
DECLARE
  own_org uuid;
  foreign_org uuid;
  affected integer;
BEGIN
  SELECT org_id INTO own_org FROM winter_decision_fixture
  WHERE actor_id=auth.uid();
  SELECT org_id INTO foreign_org FROM winter_decision_fixture
  WHERE actor_id<>auth.uid() LIMIT 1;

  IF (SELECT count(*) FROM public.professional_winter_decisions
      WHERE organization_id=own_org) <> 2 THEN
    RAISE EXCEPTION 'Own winter decisions must be visible';
  END IF;
  IF EXISTS (SELECT 1 FROM public.professional_winter_decisions
      WHERE organization_id=foreign_org) THEN
    RAISE EXCEPTION 'Foreign winter decisions were exposed';
  END IF;

  UPDATE public.professional_winter_decisions
    SET mode='not_applicable', rule_definition_id=NULL, period_kind=NULL,
      start_date=NULL, end_date=NULL, winter_days=NULL,
      project_reference=NULL, building_scope=NULL, classification=NULL,
      analogy_reference=NULL, principal_work_confirmed=false,
      exclusion_reason='heated_current_repair'
  WHERE organization_id=own_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 2 THEN RAISE EXCEPTION 'Member could not update own winter decisions'; END IF;

  UPDATE public.professional_winter_decisions
    SET exclusion_reason='heated_current_repair'
  WHERE organization_id=foreign_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Foreign winter decisions could be updated'; END IF;

  IF has_table_privilege(current_user,
    'public.professional_winter_decisions', 'DELETE') THEN
    RAISE EXCEPTION 'Members must not have DELETE access to winter decisions';
  END IF;
END
$$;
RESET ROLE;
ROLLBACK;
