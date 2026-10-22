BEGIN;

CREATE TEMP TABLE general_estimate_fixture AS
SELECT
  org_id,
  actor_id,
  object_id,
  gen_random_uuid() AS object_estimate_id,
  gen_random_uuid() AS general_estimate_id
FROM procurement_legacy_fixture;

DO $$
BEGIN
  IF to_regclass('public.professional_general_estimates') IS NULL
    OR to_regclass('public.professional_general_estimate_entries') IS NULL THEN
    RAISE EXCEPTION 'General estimate migration did not apply';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.professional_general_estimates'::regclass) IS NOT TRUE
    OR (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.professional_general_estimate_entries'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'General estimate tables must enable RLS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('professional_general_estimates', 'professional_general_estimate_entries')
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'General estimate tables must not have DELETE policies';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.professional_general_estimate_entries'::regclass
      AND attname = 'included' AND atthasdef
  ) THEN
    RAISE EXCEPTION 'included must have a database default';
  END IF;
  IF has_table_privilege(
    'anon',
    'public.professional_general_estimates',
    'DELETE'
  ) OR has_table_privilege(
    'anon',
    'public.professional_general_estimate_entries',
    'DELETE'
  ) OR has_table_privilege(
    'authenticated',
    'public.professional_general_estimates',
    'DELETE'
  ) OR has_table_privilege(
    'authenticated',
    'public.professional_general_estimate_entries',
    'DELETE'
  ) OR has_table_privilege(
    'service_role',
    'public.professional_general_estimates',
    'DELETE'
  ) OR has_table_privilege(
    'service_role',
    'public.professional_general_estimate_entries',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'Application roles must not have DELETE grants';
  END IF;
END
$$;

INSERT INTO public.professional_object_estimates
  (id, organization_id, construction_object_id, name, valuation_date, currency)
SELECT object_estimate_id, org_id, object_id, 'Object estimate for general test',
  '2026-10-15', 'MDL'
FROM general_estimate_fixture;

INSERT INTO public.professional_general_estimates
  (id, organization_id, name, valuation_date, currency)
SELECT general_estimate_id, org_id, 'General estimate test', '2026-10-15', 'MDL'
FROM general_estimate_fixture;

INSERT INTO public.professional_general_estimate_entries
  (organization_id, general_estimate_id, object_estimate_id, chapter_number, chapter_position_number)
SELECT org_id, general_estimate_id, object_estimate_id, 2, 1
FROM general_estimate_fixture;

DO $$
DECLARE
  own record;
  alternate_object_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.professional_general_estimate_entries
    WHERE included IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'included must default to true';
  END IF;

  FOR own IN SELECT * FROM general_estimate_fixture LOOP
    BEGIN
      INSERT INTO public.professional_general_estimate_entries
        (organization_id, general_estimate_id, object_estimate_id, chapter_number, chapter_position_number)
      VALUES (own.org_id, own.general_estimate_id, own.object_estimate_id, 0, 2);
      RAISE EXCEPTION 'Expected lower chapter CHECK failure';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO public.professional_general_estimate_entries
        (organization_id, general_estimate_id, object_estimate_id, chapter_number, chapter_position_number)
      VALUES (own.org_id, own.general_estimate_id, own.object_estimate_id, 13, 2);
      RAISE EXCEPTION 'Expected upper chapter CHECK failure';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO public.professional_general_estimate_entries
        (organization_id, general_estimate_id, object_estimate_id, chapter_number, chapter_position_number)
      VALUES (own.org_id, own.general_estimate_id, own.object_estimate_id, 2, 0);
      RAISE EXCEPTION 'Expected positive chapter position CHECK failure';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO public.professional_general_estimate_entries
        (organization_id, general_estimate_id, object_estimate_id, chapter_number, chapter_position_number)
      VALUES (own.org_id, own.general_estimate_id, own.object_estimate_id, 3, 2);
      RAISE EXCEPTION 'Expected duplicate membership failure';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
      alternate_object_id := gen_random_uuid();
      INSERT INTO public.professional_object_estimates
        (id, organization_id, construction_object_id, name, valuation_date, currency)
      SELECT alternate_object_id, own.org_id, construction_object_id,
        'Alternate object estimate test', '2026-10-15', 'MDL'
      FROM public.professional_object_estimates
      WHERE id = own.object_estimate_id;
      INSERT INTO public.professional_general_estimate_entries
        (organization_id, general_estimate_id, object_estimate_id, chapter_number, chapter_position_number)
      VALUES (own.org_id, own.general_estimate_id, alternate_object_id, 2, 1);
      RAISE EXCEPTION 'Expected chapter-position uniqueness failure';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;

  BEGIN
    INSERT INTO public.professional_general_estimate_entries
      (organization_id, general_estimate_id, object_estimate_id, chapter_number, chapter_position_number)
    SELECT own.org_id, other_fixture.general_estimate_id, own.object_estimate_id, 3, 1
    FROM general_estimate_fixture own
    CROSS JOIN general_estimate_fixture other_fixture
    WHERE own.org_id <> other_fixture.org_id
    LIMIT 1;
    RAISE EXCEPTION 'Expected general estimate organization FK failure';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_general_estimate_entries
      (organization_id, general_estimate_id, object_estimate_id, chapter_number, chapter_position_number)
    SELECT own.org_id, own.general_estimate_id, other_fixture.object_estimate_id, 3, 1
    FROM general_estimate_fixture own
    CROSS JOIN general_estimate_fixture other_fixture
    WHERE own.org_id <> other_fixture.org_id
    LIMIT 1;
    RAISE EXCEPTION 'Expected object estimate organization FK failure';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END
$$;

CREATE ROLE devizo_general_estimate_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_general_estimate_rls_test;
GRANT SELECT ON public.organization_members, general_estimate_fixture
  TO devizo_general_estimate_rls_test;
GRANT SELECT, INSERT, UPDATE ON public.professional_general_estimates,
  public.professional_general_estimate_entries TO devizo_general_estimate_rls_test;

DO $$
BEGIN
  IF has_table_privilege(
    'devizo_general_estimate_rls_test',
    'public.professional_general_estimates',
    'DELETE'
  ) OR has_table_privilege(
    'devizo_general_estimate_rls_test',
    'public.professional_general_estimate_entries',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'The general estimate client role must not have DELETE grants';
  END IF;
END
$$;

SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM general_estimate_fixture LIMIT 1;
SET LOCAL ROLE devizo_general_estimate_rls_test;
DO $$
DECLARE
  own_org uuid;
  foreign_org uuid;
  changed int;
BEGIN
  SELECT org_id INTO own_org FROM general_estimate_fixture WHERE actor_id = auth.uid();
  SELECT org_id INTO foreign_org FROM general_estimate_fixture WHERE actor_id <> auth.uid();
  IF (SELECT count(*) FROM public.professional_general_estimates WHERE organization_id = own_org) <> 1
    OR (SELECT count(*) FROM public.professional_general_estimate_entries WHERE organization_id = own_org) <> 1 THEN
    RAISE EXCEPTION 'Organization member must see own general estimate rows';
  END IF;
  IF EXISTS (SELECT 1 FROM public.professional_general_estimates WHERE organization_id = foreign_org)
    OR EXISTS (SELECT 1 FROM public.professional_general_estimate_entries WHERE organization_id = foreign_org) THEN
    RAISE EXCEPTION 'Cross-organization general estimate data was exposed';
  END IF;
  UPDATE public.professional_general_estimate_entries
    SET included = false WHERE organization_id = own_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Member cannot update own association'; END IF;
  UPDATE public.professional_general_estimate_entries
    SET included = false WHERE organization_id = foreign_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Cross-organization update was allowed'; END IF;
END
$$;
RESET ROLE;

ROLLBACK;
