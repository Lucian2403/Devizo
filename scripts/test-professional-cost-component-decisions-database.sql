BEGIN;

CREATE FUNCTION pg_temp.expect_component_decision_failure(
  statement text,
  expected_state text
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  actual_state text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
    IF actual_state = expected_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected SQLSTATE %, got % for %',
      expected_state, actual_state, statement;
  END;
  RAISE EXCEPTION 'Expected rejection for %', statement;
END
$$;

DO $$
DECLARE
  fixture_a record;
  fixture_b record;
  source_a uuid := gen_random_uuid();
  source_b uuid := gen_random_uuid();
  rule_a uuid := gen_random_uuid();
  rule_b uuid := gen_random_uuid();
  rule_overhead uuid := gen_random_uuid();
  decision_id uuid := gen_random_uuid();
  reused_source_id uuid;
  sql text;
BEGIN
  SELECT * INTO fixture_a FROM procurement_legacy_fixture ORDER BY org_id LIMIT 1;
  SELECT * INTO fixture_b FROM procurement_legacy_fixture ORDER BY org_id DESC LIMIT 1;

  INSERT INTO public.normative_sources
    (id, organization_id, code, title, edition, source_type, jurisdiction,
     status, official_status, monitoring_enabled)
  VALUES
    (source_a, fixture_a.org_id, 'DEVIZO-COMPANY-CALC-RULES',
      'Reguli interne de calcul ale companiei', '1', 'company_custom',
      'MD', 'active', 'unknown', false),
    (source_b, fixture_b.org_id, 'DEVIZO-COMPANY-CALC-RULES',
      'Conflicting normative source', '1', 'official_law',
      'RO', 'inactive', 'official', true);
  INSERT INTO public.normative_sources
    (organization_id, code, title, edition, source_type, jurisdiction, status,
     official_status, monitoring_enabled)
  VALUES
    (fixture_a.org_id, 'DEVIZO-COMPANY-CALC-RULES',
      'Reguli interne de calcul ale companiei', '1', 'company_custom',
      'MD', 'active', 'unknown', false)
  ON CONFLICT (organization_id, code, edition)
  DO NOTHING
  RETURNING id INTO reused_source_id;
  IF reused_source_id IS NOT NULL THEN
    RAISE EXCEPTION 'An existing company calculation source must not be replaced';
  END IF;
  SELECT id INTO reused_source_id
  FROM public.normative_sources
  WHERE organization_id = fixture_a.org_id
    AND code = 'DEVIZO-COMPANY-CALC-RULES' AND edition = '1';
  IF reused_source_id <> source_a THEN
    RAISE EXCEPTION 'Company calculation source identity was not idempotently reused';
  END IF;
  INSERT INTO public.normative_sources
    (organization_id, code, title, edition, source_type, jurisdiction, status,
     official_status, monitoring_enabled)
  VALUES
    (fixture_b.org_id, 'DEVIZO-COMPANY-CALC-RULES',
      'Reguli interne de calcul ale companiei', '1', 'company_custom',
      'MD', 'active', 'unknown', false)
  ON CONFLICT (organization_id, code, edition) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM public.normative_sources
    WHERE id = source_b AND source_type = 'official_law'
      AND title = 'Conflicting normative source'
      AND jurisdiction = 'RO' AND status = 'inactive'
      AND official_status = 'official' AND monitoring_enabled = true
  ) THEN RAISE EXCEPTION 'A conflicting reserved source was mutated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.normative_sources
    WHERE id = source_a AND source_type = 'company_custom'
      AND status = 'active' AND official_status = 'unknown'
      AND monitoring_enabled = false AND jurisdiction = 'MD'
      AND title = 'Reguli interne de calcul ale companiei'
  ) THEN RAISE EXCEPTION 'Company calculation source metadata is incorrect'; END IF;

  INSERT INTO public.professional_rule_definitions
    (id, organization_id, source_id, name, component, value_type, value,
     calculation_basis, valid_from, estimate_perspective, work_kind, rule_origin)
  VALUES
    (rule_a, fixture_a.org_id, source_a, 'Internal labor fixture',
      'labor_contributions', 'percent', 5, 'labor_cost', '2012-08-17',
      'investor', 'construction', 'company_individual'),
    (rule_b, fixture_b.org_id, source_b, 'Foreign labor fixture',
      'labor_contributions', 'percent', 5, 'labor_cost', '2012-08-17',
      'investor', 'construction', 'company_individual'),
    (rule_overhead, fixture_a.org_id, source_a, 'Internal overhead fixture',
      'overhead', 'percent', 5, 'direct_cost', '2012-08-17',
      'investor', 'construction', 'company_individual');

  sql := format(
    'INSERT INTO public.professional_cost_component_decisions
      (organization_id, calculation_context_id, component, decision,
       professional_rule_definition_id)
     VALUES (%L,%L,''labor_contributions'',''applied'',%L)',
    fixture_a.org_id, fixture_a.context_id, rule_a);
  PERFORM pg_temp.expect_component_decision_failure(
    replace(sql, '''labor_contributions''', '''procurement_storage'''),
    '23514');
  PERFORM pg_temp.expect_component_decision_failure(
    replace(sql, '''applied''', '''unknown'''),
    '23514');
  PERFORM pg_temp.expect_component_decision_failure(
    replace(sql, format(',%L)', rule_a), ',NULL)'),
    '23514');
  PERFORM pg_temp.expect_component_decision_failure(
    format(
      'INSERT INTO public.professional_cost_component_decisions
       (organization_id, calculation_context_id, component, decision, reason,
        professional_rule_definition_id)
       VALUES (%L,%L,''overhead'',''not_applicable'',''Reason'',%L)',
      fixture_a.org_id, fixture_a.context_id, rule_a),
    '23514');
  PERFORM pg_temp.expect_component_decision_failure(
    replace(sql, format('%L,%L,''labor_contributions''', fixture_a.org_id, fixture_a.context_id),
      format('%L,%L,''labor_contributions''', fixture_a.org_id, fixture_b.context_id)),
    '23503');
  PERFORM pg_temp.expect_component_decision_failure(
    replace(sql, rule_a::text, rule_b::text),
    '23503');
  PERFORM pg_temp.expect_component_decision_failure(
    format(
      'INSERT INTO public.professional_cost_component_decisions
       (organization_id, calculation_context_id, component, decision,
        professional_rule_definition_id)
       VALUES (%L,%L,''overhead'',''applied'',%L)',
      fixture_a.org_id, fixture_a.context_id, rule_a),
    '23503');
  PERFORM pg_temp.expect_component_decision_failure(
    format(
      'INSERT INTO public.professional_cost_component_decisions
       (organization_id, calculation_context_id, component, decision,
        professional_rule_definition_id)
       VALUES (%L,%L,''labor_contributions'',''applied'',%L)',
      fixture_a.org_id, fixture_a.context_id, rule_overhead),
    '23503');

  INSERT INTO public.professional_cost_component_decisions
    (id, organization_id, calculation_context_id, component, decision,
     professional_rule_definition_id)
  VALUES
    (decision_id, fixture_a.org_id, fixture_a.context_id,
      'labor_contributions', 'applied', rule_a);
  INSERT INTO public.professional_cost_component_decisions
    (organization_id, calculation_context_id, component, decision,
     professional_rule_definition_id)
  VALUES
    (fixture_a.org_id, fixture_a.context_id, 'overhead', 'applied',
      rule_overhead);
  PERFORM pg_temp.expect_component_decision_failure(
    sql,
    '23505');
  INSERT INTO public.professional_cost_component_decisions
    (organization_id, calculation_context_id, component, decision, reason)
  VALUES
    (fixture_a.org_id, fixture_a.context_id, 'estimated_profit',
      'not_applicable', 'Explicit company decision');
END
$$;

CREATE ROLE devizo_cost_decisions_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_cost_decisions_rls_test;
GRANT SELECT ON public.organization_members TO devizo_cost_decisions_rls_test;
GRANT SELECT, INSERT, UPDATE ON public.professional_cost_component_decisions
  TO devizo_cost_decisions_rls_test;
GRANT SELECT ON procurement_legacy_fixture TO devizo_cost_decisions_rls_test;

SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM procurement_legacy_fixture ORDER BY org_id LIMIT 1;
SET LOCAL ROLE devizo_cost_decisions_rls_test;
DO $$
DECLARE
  own_org uuid;
  foreign_org uuid;
  own_context uuid;
  foreign_context uuid;
  own_rule uuid;
  affected int;
BEGIN
  SELECT org_id, context_id INTO own_org, own_context
  FROM procurement_legacy_fixture WHERE actor_id = auth.uid();
  SELECT org_id, context_id INTO foreign_org, foreign_context
  FROM procurement_legacy_fixture WHERE actor_id <> auth.uid();
  SELECT professional_rule_definition_id INTO own_rule
  FROM public.professional_cost_component_decisions
  WHERE organization_id = own_org AND component = 'labor_contributions';
  IF own_rule IS NULL THEN RAISE EXCEPTION 'Own decision must be visible'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.professional_cost_component_decisions
    WHERE organization_id = foreign_org
  ) THEN RAISE EXCEPTION 'Another organization decision was exposed'; END IF;

  INSERT INTO public.professional_cost_component_decisions
    (organization_id, calculation_context_id, component, decision, reason)
  VALUES (own_org, own_context, 'estimated_profit',
    'not_applicable', 'Owned by current organization');
  UPDATE public.professional_cost_component_decisions
    SET decision = 'not_applicable', professional_rule_definition_id = NULL,
        reason = 'Updated explicit reason'
    WHERE organization_id = own_org AND component = 'labor_contributions';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own decision update failed'; END IF;

  UPDATE public.professional_cost_component_decisions
    SET reason = 'Cross-organization mutation'
    WHERE organization_id = foreign_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-organization update was allowed'; END IF;
  PERFORM pg_temp.expect_component_decision_failure(
    format(
      'INSERT INTO public.professional_cost_component_decisions
       (organization_id, calculation_context_id, component, decision, reason)
       VALUES (%L,%L,''estimated_profit'',''not_applicable'',''Denied'')',
      foreign_org, foreign_context),
    '42501');
  IF has_table_privilege(current_user,
    'public.professional_cost_component_decisions', 'DELETE') THEN
    RAISE EXCEPTION 'Decision DELETE must not be granted';
  END IF;
END
$$;
RESET ROLE;
ROLLBACK;
