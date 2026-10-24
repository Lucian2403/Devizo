BEGIN;

CREATE TEMP TABLE temporary_works_fixture AS
SELECT
  org_id,
  actor_id,
  object_id,
  gen_random_uuid() AS object_estimate_id,
  gen_random_uuid() AS general_estimate_id,
  gen_random_uuid() AS source_id,
  gen_random_uuid() AS applicability_id,
  gen_random_uuid() AS rule_id
FROM procurement_legacy_fixture;

DO $$
BEGIN
  IF to_regclass('public.professional_general_rule_definitions') IS NULL
    OR to_regclass('public.professional_general_cost_decisions') IS NULL THEN
    RAISE EXCEPTION 'Temporary works migration did not apply';
  END IF;

  IF (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.professional_general_rule_definitions'::regclass) IS NOT TRUE
    OR (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.professional_general_cost_decisions'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'Temporary works tables must enable RLS';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'professional_general_rule_definitions',
        'professional_general_cost_decisions'
      )
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'Temporary works tables must not have DELETE policies';
  END IF;
END
$$;

INSERT INTO public.professional_object_estimates
  (id, organization_id, construction_object_id, name, valuation_date, currency)
SELECT object_estimate_id, org_id, object_id,
  'Object estimate for temporary works test', '2026-10-15', 'MDL'
FROM temporary_works_fixture;

INSERT INTO public.professional_general_estimates
  (id, organization_id, name, valuation_date, currency)
SELECT general_estimate_id, org_id,
  'General estimate temporary works test', '2026-10-15', 'MDL'
FROM temporary_works_fixture;

INSERT INTO public.normative_sources
  (id, organization_id, code, title, edition, source_type, jurisdiction,
   effective_date, valid_from, status, official_status, monitoring_enabled)
SELECT source_id, org_id,
  'NCM L.02.05-2012',
  'Temporary works source fixture',
  '2012',
  'normative_document',
  'MD',
  '2013-02-15',
  '2013-02-15',
  'active',
  'in_force',
  false
FROM temporary_works_fixture;

INSERT INTO public.normative_applicability_decisions
  (id, organization_id, source_id, revision, decision, applicable_from,
   decided_by_user_id, basis_note, source_code, source_edition, official_status)
SELECT applicability_id, org_id, source_id, 1, 'applicable', '2013-02-15',
  actor_id, 'Temporary works DB fixture', 'NCM L.02.05-2012', '2012', 'in_force'
FROM temporary_works_fixture;

INSERT INTO public.professional_general_rule_definitions
  (id, organization_id, source_id, applicability_decision_id, component,
   rule_code, group_code, group_label, name, value_type, value, valid_from,
   source_reference)
SELECT rule_id, org_id, source_id, applicability_id, 'temporary_works',
  '025', 'civil', 'Civil', 'School fixture', 'percent', 0.8, '2013-02-15',
  'NCM L.02.05-2012, pct. 4.6, poziția 25'
FROM temporary_works_fixture;

INSERT INTO public.professional_general_cost_decisions
  (organization_id, general_estimate_id, component, mode, rule_definition_id,
   project_condition)
SELECT org_id, general_estimate_id, 'temporary_works', 'normative_rate',
  rule_id, 'standard'
FROM temporary_works_fixture;

DO $$
DECLARE
  own record;
  other record;
  scratch_general uuid;
  scratch_general_for_cross_rule uuid;
  alternate_applicability uuid;
BEGIN
  SELECT * INTO own FROM temporary_works_fixture ORDER BY org_id LIMIT 1;
  SELECT * INTO other FROM temporary_works_fixture
    WHERE org_id <> own.org_id ORDER BY org_id LIMIT 1;

  scratch_general := gen_random_uuid();
  INSERT INTO public.professional_general_estimates
    (id, organization_id, name, valuation_date, currency)
  VALUES (
    scratch_general, own.org_id, 'Scratch general estimate',
    '2026-10-15', 'MDL'
  );

  alternate_applicability := gen_random_uuid();
  INSERT INTO public.normative_applicability_decisions
    (id, organization_id, source_id, revision, decision, applicable_from,
     decided_by_user_id, basis_note, source_code, source_edition, official_status)
  VALUES (
    alternate_applicability, own.org_id, own.source_id, 2, 'applicable',
    '2013-02-15', own.actor_id, 'Second applicability revision fixture',
    'NCM L.02.05-2012', '2012', 'in_force'
  );

  BEGIN
    INSERT INTO public.professional_general_rule_definitions
      (organization_id, source_id, applicability_decision_id, component,
       rule_code, group_code, group_label, name, value_type, value, valid_from,
       source_reference)
    VALUES (
      own.org_id, own.source_id, alternate_applicability, 'temporary_works',
      '025', 'civil', 'Civil', 'School fixture', 'percent', 0.8,
      '2013-02-15', 'NCM L.02.05-2012, pct. 4.6, poziția 25'
    );
    RAISE EXCEPTION 'Expected pack rule identity uniqueness failure';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  scratch_general_for_cross_rule := gen_random_uuid();
  INSERT INTO public.professional_general_estimates
    (id, organization_id, name, valuation_date, currency)
  VALUES (
    scratch_general_for_cross_rule, own.org_id,
    'Cross rule scratch estimate', '2026-10-15', 'MDL'
  );

  BEGIN
    INSERT INTO public.professional_general_rule_definitions
      (organization_id, source_id, applicability_decision_id, component,
       rule_code, group_code, group_label, name, value_type, value, valid_from,
       source_reference)
    VALUES (
      own.org_id, own.source_id, own.applicability_id, 'temporary_works',
      'BAD0', 'test', 'Test', 'Bad zero rate', 'percent', 0, '2013-02-15',
      'fixture'
    );
    RAISE EXCEPTION 'Expected positive rate CHECK failure';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_cost_decisions
      (organization_id, general_estimate_id, component, mode,
       rule_definition_id, project_condition)
    VALUES (
      own.org_id, own.general_estimate_id, 'temporary_works',
      'normative_rate', own.rule_id, 'invented_coefficient'
    );
    RAISE EXCEPTION 'Expected project condition CHECK failure';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_cost_decisions
      (organization_id, general_estimate_id, component, mode,
       project_construction_amount, project_installation_amount,
       project_reference)
    VALUES (
      own.org_id, scratch_general, 'temporary_works',
      'project_calculation', 0, 0, 'zero fixture'
    );
    RAISE EXCEPTION 'Expected zero project-calculation CHECK failure';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_cost_decisions
      (organization_id, general_estimate_id, component, mode,
       rule_definition_id, project_condition)
    VALUES (
      own.org_id, own.general_estimate_id, 'temporary_works',
      'normative_rate', own.rule_id, 'standard'
    );
    RAISE EXCEPTION 'Expected one-decision-per-component uniqueness failure';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_cost_decisions
      (organization_id, general_estimate_id, component, mode,
       rule_definition_id, project_condition)
    VALUES (
      own.org_id, other.general_estimate_id, 'temporary_works',
      own.rule_id, 'standard'
    );
    RAISE EXCEPTION 'Expected cross-org general estimate FK failure';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_cost_decisions
      (organization_id, general_estimate_id, component, mode,
       rule_definition_id, project_condition)
    VALUES (
      own.org_id, scratch_general_for_cross_rule, 'temporary_works',
      other.rule_id, 'standard'
    );
    RAISE EXCEPTION 'Expected cross-org rule FK failure';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_rule_definitions
      (organization_id, source_id, applicability_decision_id, component,
       rule_code, group_code, group_label, name, value_type, value, valid_from,
       source_reference)
    VALUES (
      own.org_id, other.source_id, own.applicability_id, 'temporary_works',
      'X', 'test', 'Test', 'Cross source', 'percent', 1, '2013-02-15',
      'fixture'
    );
    RAISE EXCEPTION 'Expected source/applicability composite FK failure';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END
$$;

CREATE ROLE devizo_temporary_works_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_temporary_works_rls_test;
GRANT SELECT ON public.organization_members, temporary_works_fixture
  TO devizo_temporary_works_rls_test;
GRANT SELECT, INSERT, UPDATE ON
  public.professional_general_rule_definitions,
  public.professional_general_cost_decisions
  TO devizo_temporary_works_rls_test;

DO $$
BEGIN
  IF has_table_privilege(
    'devizo_temporary_works_rls_test',
    'public.professional_general_rule_definitions',
    'DELETE'
  ) OR has_table_privilege(
    'devizo_temporary_works_rls_test',
    'public.professional_general_cost_decisions',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'Temporary works client role must not have DELETE grants';
  END IF;
END
$$;

SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM temporary_works_fixture LIMIT 1;
SET LOCAL ROLE devizo_temporary_works_rls_test;

DO $$
DECLARE
  own_org uuid;
  foreign_org uuid;
  changed int;
BEGIN
  SELECT org_id INTO own_org
  FROM temporary_works_fixture WHERE actor_id = auth.uid();

  SELECT org_id INTO foreign_org
  FROM temporary_works_fixture WHERE actor_id <> auth.uid() LIMIT 1;

  IF (SELECT count(*) FROM public.professional_general_rule_definitions
      WHERE organization_id = own_org) <> 1 THEN
    RAISE EXCEPTION 'Member must see own temporary-work rule';
  END IF;

  IF (SELECT count(*) FROM public.professional_general_cost_decisions
      WHERE organization_id = own_org) <> 1 THEN
    RAISE EXCEPTION 'Member must see own temporary-work decision';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.professional_general_rule_definitions
    WHERE organization_id = foreign_org
  ) OR EXISTS (
    SELECT 1 FROM public.professional_general_cost_decisions
    WHERE organization_id = foreign_org
  ) THEN
    RAISE EXCEPTION 'Cross-organization temporary-work data was exposed';
  END IF;

  UPDATE public.professional_general_cost_decisions
    SET project_condition = 'capital_repair_complex'
    WHERE organization_id = own_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN
    RAISE EXCEPTION 'Member cannot update own temporary-work decision';
  END IF;

  UPDATE public.professional_general_cost_decisions
    SET project_condition = 'capital_repair_complex'
    WHERE organization_id = foreign_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN
    RAISE EXCEPTION 'Cross-organization update was allowed';
  END IF;
END
$$;

RESET ROLE;
ROLLBACK;
