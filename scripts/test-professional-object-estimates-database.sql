BEGIN;

CREATE TEMP TABLE object_estimate_fixture AS
SELECT org_id, actor_id, context_id, object_id, gen_random_uuid() AS estimate_id
FROM procurement_legacy_fixture;

DO $$
BEGIN
  IF to_regclass('public.professional_object_estimates') IS NULL
    OR to_regclass('public.professional_object_estimate_entries') IS NULL THEN
    RAISE EXCEPTION 'Object estimate migration did not apply';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.professional_object_estimate_entries'::regclass
      AND attname = 'included' AND atthasdef
  ) THEN
    RAISE EXCEPTION 'included must have a database default';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.professional_object_estimates'::regclass) IS NOT TRUE
    OR (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.professional_object_estimate_entries'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'Object estimate tables must enable RLS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('professional_object_estimates', 'professional_object_estimate_entries')
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'Object estimate tables must not have DELETE policies';
  END IF;
END
$$;

INSERT INTO public.professional_object_estimates
  (id, organization_id, construction_object_id, name, valuation_date, currency)
SELECT estimate_id, org_id, object_id, 'Object estimate test', '2026-06-15', 'MDL'
FROM object_estimate_fixture;

INSERT INTO public.professional_object_estimate_entries
  (organization_id, object_estimate_id, calculation_context_id, position_number, cost_category)
SELECT org_id, estimate_id, context_id, 1, 'construction_works'
FROM object_estimate_fixture;

DO $$
DECLARE
  fixture record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.professional_object_estimate_entries
    WHERE included IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'included must default to true';
  END IF;

  BEGIN
    UPDATE public.professional_object_estimate_entries
      SET cost_category = 'unknown'
      WHERE id = (SELECT id FROM public.professional_object_estimate_entries LIMIT 1);
    RAISE EXCEPTION 'Expected cost category CHECK failure';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.professional_object_estimate_entries
      (organization_id, object_estimate_id, calculation_context_id, position_number, cost_category)
    SELECT foreign_org.org_id, own.estimate_id, foreign_org.context_id, 2, 'construction_works'
    FROM object_estimate_fixture own
    CROSS JOIN object_estimate_fixture foreign_org
    WHERE own.org_id <> foreign_org.org_id
    LIMIT 1;
    RAISE EXCEPTION 'Expected object estimate organization FK failure';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.professional_object_estimates
      (organization_id, construction_object_id, name, valuation_date, currency)
    SELECT own.org_id, foreign_org.object_id, 'Cross organization object', '2026-06-15', 'MDL'
    FROM object_estimate_fixture own
    CROSS JOIN object_estimate_fixture foreign_org
    WHERE own.org_id <> foreign_org.org_id
    LIMIT 1;
    RAISE EXCEPTION 'Expected organization/object composite FK failure';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.professional_object_estimate_entries
      (organization_id, object_estimate_id, calculation_context_id, position_number, cost_category)
    SELECT own.org_id, own.estimate_id, foreign_org.context_id, 2, 'construction_works'
    FROM object_estimate_fixture own
    CROSS JOIN object_estimate_fixture foreign_org
    WHERE own.org_id <> foreign_org.org_id
    LIMIT 1;
    RAISE EXCEPTION 'Expected calculation context organization FK failure';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.professional_object_estimate_entries
      (organization_id, object_estimate_id, calculation_context_id, position_number, cost_category)
    SELECT org_id, estimate_id, context_id, 2, 'construction_works'
    FROM object_estimate_fixture
    LIMIT 1;
    RAISE EXCEPTION 'Expected unique local membership failure';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$$;

CREATE ROLE devizo_object_estimate_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_object_estimate_rls_test;
GRANT SELECT ON public.organization_members, procurement_legacy_fixture
  TO devizo_object_estimate_rls_test;
GRANT SELECT, INSERT, UPDATE ON public.professional_object_estimates,
  public.professional_object_estimate_entries TO devizo_object_estimate_rls_test;

DO $$
BEGIN
  IF has_table_privilege(
    'devizo_object_estimate_rls_test',
    'public.professional_object_estimates',
    'DELETE'
  ) OR has_table_privilege(
    'devizo_object_estimate_rls_test',
    'public.professional_object_estimate_entries',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'The object estimate client role must not have DELETE grants';
  END IF;
END
$$;

SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM object_estimate_fixture LIMIT 1;
SET LOCAL ROLE devizo_object_estimate_rls_test;
DO $$
DECLARE
  own_org uuid;
  foreign_org uuid;
  changed int;
BEGIN
  SELECT org_id INTO own_org FROM procurement_legacy_fixture WHERE actor_id = auth.uid();
  SELECT org_id INTO foreign_org FROM procurement_legacy_fixture WHERE actor_id <> auth.uid();
  IF (SELECT count(*) FROM public.professional_object_estimates WHERE organization_id = own_org) <> 1
    OR (SELECT count(*) FROM public.professional_object_estimate_entries WHERE organization_id = own_org) <> 1 THEN
    RAISE EXCEPTION 'Organization member must see own object estimate rows';
  END IF;
  IF EXISTS (SELECT 1 FROM public.professional_object_estimates WHERE organization_id = foreign_org)
    OR EXISTS (SELECT 1 FROM public.professional_object_estimate_entries WHERE organization_id = foreign_org) THEN
    RAISE EXCEPTION 'Cross-organization object estimate data was exposed';
  END IF;
  UPDATE public.professional_object_estimate_entries
    SET included = false WHERE organization_id = own_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Member cannot update own membership'; END IF;
  UPDATE public.professional_object_estimate_entries
    SET included = false WHERE organization_id = foreign_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Cross-organization update was allowed'; END IF;
END
$$;
RESET ROLE;

ROLLBACK;
