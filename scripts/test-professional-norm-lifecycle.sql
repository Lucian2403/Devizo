BEGIN;

CREATE FUNCTION pg_temp.expect_norm_lifecycle_failure(
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
  org_id uuid := gen_random_uuid();
  internal_source_id uuid := gen_random_uuid();
  norm_id uuid := gen_random_uuid();
  resource_id uuid := gen_random_uuid();
  version_one_id uuid;
  version_two_id uuid;
  inserted_version_id uuid;
  version_status text;
  resource_price_count int;
BEGIN
  INSERT INTO public.organizations (id, name, slug)
    VALUES (org_id, 'M8.4B norm lifecycle test', org_id::text);

  INSERT INTO public.normative_sources
    (id, organization_id, code, title, edition, source_type, jurisdiction,
     status, official_status, monitoring_enabled, last_verification_status)
    VALUES
    (internal_source_id, org_id, 'DEVIZO-COMPANY-NORMS',
     'Norme interne ale companiei', '1', 'company_custom', 'MD',
     'active', 'unknown', false, 'never');

  INSERT INTO public.estimate_norms
    (id, organization_id, namespace, code, name)
    VALUES
    (norm_id, org_id, 'company_custom', 'TEST-TENC-001',
     'Tencuieli interioare — normă internă de test');

  -- The M8.4B insert omits publication_status and relies on its draft default.
  INSERT INTO public.estimate_norm_versions
    (organization_id, estimate_norm_id, source_id, version_label,
     method, basis_quantity, basis_unit)
    VALUES (org_id, norm_id, internal_source_id, '1', 'resource', 100, 'm²')
    RETURNING id INTO version_one_id;

  SELECT publication_status INTO version_status
    FROM public.estimate_norm_versions WHERE id = version_one_id;
  IF version_status <> 'draft' THEN
    RAISE EXCEPTION 'Internal version did not start in draft';
  END IF;

  INSERT INTO public.professional_resources
    (id, organization_id, source_id, code, name, resource_type, unit)
    VALUES
    (resource_id, org_id, internal_source_id, 'LAB-001',
     'Muncitor constructor', 'labor', 'h');
  INSERT INTO public.resource_consumptions
    (organization_id, estimate_norm_version_id, resource_id,
     position_number, quantity_per_norm_basis)
    VALUES (org_id, version_one_id, resource_id, 1, 10);

  -- Follow the exact lifecycle transitions required by the existing trigger.
  UPDATE public.estimate_norm_versions
    SET publication_status = 'in_review' WHERE id = version_one_id;
  UPDATE public.estimate_norm_versions
    SET publication_status = 'approved' WHERE id = version_one_id;
  UPDATE public.estimate_norm_versions
    SET publication_status = 'published' WHERE id = version_one_id;

  SELECT publication_status INTO version_status
    FROM public.estimate_norm_versions WHERE id = version_one_id;
  IF version_status <> 'published' OR NOT EXISTS (
    SELECT 1 FROM public.estimate_norm_versions
    WHERE id = version_one_id AND publication_status = 'published'
  ) THEN
    RAISE EXCEPTION 'Published internal version is not eligible for use';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.normative_applicability_decisions
    WHERE organization_id = org_id
      AND normative_applicability_decisions.source_id = internal_source_id
  ) THEN
    RAISE EXCEPTION 'Internal company source must not receive applicability decisions';
  END IF;

  PERFORM pg_temp.expect_norm_lifecycle_failure(format(
    'INSERT INTO public.resource_consumptions
       (organization_id, estimate_norm_version_id, resource_id,
        position_number, quantity_per_norm_basis)
     VALUES (%L,%L,%L,2,1)',
    org_id, version_one_id, resource_id), '55000');
  PERFORM pg_temp.expect_norm_lifecycle_failure(format(
    'UPDATE public.resource_consumptions
       SET quantity_per_norm_basis = 11
     WHERE estimate_norm_version_id = %L',
    version_one_id), '55000');

  -- A stable estimate_norm identity can own another draft version.
  INSERT INTO public.estimate_norm_versions
    (organization_id, estimate_norm_id, source_id, version_label,
     method, basis_quantity, basis_unit)
    VALUES (org_id, norm_id, internal_source_id, '2', 'resource', 100, 'm²')
    RETURNING id INTO version_two_id;
  SELECT estimate_norm_id INTO inserted_version_id
    FROM public.estimate_norm_versions WHERE id = version_two_id;
  IF inserted_version_id <> norm_id OR version_one_id = version_two_id THEN
    RAISE EXCEPTION 'Version 2 did not reuse the stable estimate_norm identity';
  END IF;
  SELECT publication_status INTO version_status
    FROM public.estimate_norm_versions WHERE id = version_two_id;
  IF version_status <> 'draft' THEN
    RAISE EXCEPTION 'Second internal version did not start in draft';
  END IF;
  PERFORM pg_temp.expect_norm_lifecycle_failure(format(
    'INSERT INTO public.estimate_norm_versions
       (organization_id, estimate_norm_id, source_id, version_label,
        method, basis_quantity, basis_unit)
     VALUES (%L,%L,%L,''1'',''resource'',100,''m²'')',
    org_id, norm_id, internal_source_id), '23505');
  IF EXISTS (
    SELECT 1 FROM public.estimate_norm_versions
    WHERE estimate_norm_id = norm_id
      AND publication_status = 'published'
      AND version_label = '2'
  ) THEN
    RAISE EXCEPTION 'Draft version 2 was treated as assignable';
  END IF;

  SELECT count(*) INTO resource_price_count
    FROM public.resource_prices WHERE organization_id = org_id;
  IF resource_price_count <> 0 THEN
    RAISE EXCEPTION 'M8.4B created resource prices';
  END IF;
END
$$;

ROLLBACK;
