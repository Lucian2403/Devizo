BEGIN;

CREATE FUNCTION pg_temp.expect_procurement_failure(statement text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN check_violation THEN RETURN;
  END;
  RAISE EXCEPTION 'Expected CHECK violation for %', statement;
END
$$;

DO $$
DECLARE
  fixture record;
  value text;
BEGIN
  FOR fixture IN SELECT * FROM procurement_legacy_fixture LOOP
    IF NOT EXISTS (SELECT 1 FROM public.resource_prices
      WHERE id = fixture.price_id AND vat_treatment = 'unknown'
      AND transport_treatment = 'unknown' AND price = 1200 AND basis_quantity = 100) THEN
      RAISE EXCEPTION 'Migration invented semantics or changed old price data';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.calculation_contexts
      WHERE id = fixture.context_id AND estimate_perspective IS NULL AND work_kind IS NULL) THEN
      RAISE EXCEPTION 'Migration classified an old calculation context';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.professional_resources
      WHERE id = fixture.resource_id AND procurement_category IS NULL) THEN
      RAISE EXCEPTION 'Migration classified an old material';
    END IF;
    PERFORM pg_temp.expect_procurement_failure(format(
      'UPDATE public.calculation_contexts SET estimate_perspective = ''any'' WHERE id = %L', fixture.context_id));
    PERFORM pg_temp.expect_procurement_failure(format(
      'UPDATE public.calculation_contexts SET work_kind = ''other'' WHERE id = %L', fixture.context_id));
    PERFORM pg_temp.expect_procurement_failure(format(
      'UPDATE public.professional_resources SET procurement_category = ''inferred'' WHERE id = %L', fixture.resource_id));
    PERFORM pg_temp.expect_procurement_failure(format(
      'UPDATE public.resource_prices SET vat_treatment = ''invalid'' WHERE id = %L', fixture.price_id));
    PERFORM pg_temp.expect_procurement_failure(format(
      'UPDATE public.resource_prices SET transport_treatment = ''invalid'' WHERE id = %L', fixture.price_id));
    FOREACH value IN ARRAY ARRAY['construction_materials', 'metal_structures', 'equipment', 'other'] LOOP
      UPDATE public.professional_resources SET procurement_category = value WHERE id = fixture.resource_id;
      IF NOT EXISTS (SELECT 1 FROM public.professional_resources WHERE id = fixture.resource_id
        AND procurement_category = value) THEN RAISE EXCEPTION 'Category did not persist'; END IF;
    END LOOP;
  END LOOP;
END
$$;

CREATE ROLE devizo_procurement_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_procurement_rls_test;
GRANT SELECT ON public.organization_members TO devizo_procurement_rls_test;
GRANT SELECT, UPDATE ON public.resource_prices, public.professional_resources,
  public.calculation_contexts TO devizo_procurement_rls_test;
GRANT SELECT ON procurement_legacy_fixture TO devizo_procurement_rls_test;

SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM procurement_legacy_fixture LIMIT 1;
SET LOCAL ROLE devizo_procurement_rls_test;
DO $$
DECLARE
  own_org uuid;
  foreign_org uuid;
  affected int;
BEGIN
  SELECT org_id INTO own_org FROM procurement_legacy_fixture
    WHERE actor_id = auth.uid();
  SELECT org_id INTO foreign_org FROM procurement_legacy_fixture
    WHERE actor_id <> auth.uid();
  IF (SELECT count(*) FROM public.resource_prices WHERE organization_id = own_org) <> 1 THEN
    RAISE EXCEPTION 'Own price must be visible';
  END IF;
  IF EXISTS (SELECT 1 FROM public.resource_prices WHERE organization_id = foreign_org)
    OR EXISTS (SELECT 1 FROM public.professional_resources WHERE organization_id = foreign_org)
    OR EXISTS (SELECT 1 FROM public.calculation_contexts WHERE organization_id = foreign_org) THEN
    RAISE EXCEPTION 'Another organization data was exposed';
  END IF;
  UPDATE public.resource_prices SET vat_treatment = 'exclusive', transport_treatment = 'excluded'
    WHERE organization_id = own_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own price classification failed'; END IF;
  UPDATE public.professional_resources SET procurement_category = 'metal_structures'
    WHERE organization_id = own_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own resource classification failed'; END IF;
  UPDATE public.calculation_contexts SET estimate_perspective = 'investor', work_kind = 'construction'
    WHERE organization_id = own_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own context classification failed'; END IF;
  UPDATE public.resource_prices SET vat_treatment = 'inclusive' WHERE organization_id = foreign_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-org price mutation allowed'; END IF;
  UPDATE public.professional_resources SET procurement_category = 'other' WHERE organization_id = foreign_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-org resource mutation allowed'; END IF;
  UPDATE public.calculation_contexts SET estimate_perspective = 'contractor' WHERE organization_id = foreign_org;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-org context mutation allowed'; END IF;
END
$$;
RESET ROLE;
ROLLBACK;
