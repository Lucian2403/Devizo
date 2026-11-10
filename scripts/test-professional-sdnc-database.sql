BEGIN;

DO $$
BEGIN
  IF to_regclass('public.professional_sdnc_decisions') IS NULL THEN
    RAISE EXCEPTION 'SDNC migration 0029 was not applied';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.professional_sdnc_decisions'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'SDNC member RLS missing';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='professional_sdnc_decisions'
        AND policyname IN ('professional_sdnc_select_member',
          'professional_sdnc_insert_member','professional_sdnc_update_member')) <> 3 THEN
    RAISE EXCEPTION 'SDNC member policies missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='professional_sdnc_decisions'
        AND cmd='DELETE') THEN
    RAISE EXCEPTION 'SDNC must not allow DELETE policies';
  END IF;
END
$$;

CREATE TEMP TABLE sdnc_fixture AS
SELECT org_id, actor_id, gen_random_uuid() AS general_id
FROM procurement_legacy_fixture;

INSERT INTO public.professional_general_estimates
  (id, organization_id, name, valuation_date, currency)
SELECT general_id, org_id, 'SDNC 2026 fixture', '2026-10-15', 'MDL'
FROM sdnc_fixture;

INSERT INTO public.professional_sdnc_decisions
  (organization_id, general_estimate_id, fiscal_year, legal_version,
   mode, work_kind, permit_confirmed, non_public_funding_confirmed,
   not_exempt_house_confirmed, annual_eligible_investment_mdl,
   supporting_document, basis_note)
SELECT org_id, general_id, 2026, 'MD-SDNC-2026-L153-SFS432',
  'liable', 'new_construction', true, true, true, 1000000,
  'Annual investment document', 'Authorisation and own financing'
FROM sdnc_fixture;

DO $$
DECLARE
  own_row record;
  other_row record;
  scratch_id uuid := gen_random_uuid();
BEGIN
  SELECT * INTO own_row FROM sdnc_fixture ORDER BY org_id LIMIT 1;
  SELECT * INTO other_row FROM sdnc_fixture
    WHERE org_id <> own_row.org_id LIMIT 1;

  INSERT INTO public.professional_general_estimates
    (id,organization_id,name,valuation_date,currency)
  VALUES (scratch_id,own_row.org_id,'SDNC scratch','2026-10-15','MDL');

  BEGIN
    INSERT INTO public.professional_sdnc_decisions
      (organization_id,general_estimate_id,fiscal_year,legal_version,mode,
       work_kind,permit_confirmed,non_public_funding_confirmed,
       not_exempt_house_confirmed,annual_eligible_investment_mdl,
       supporting_document,basis_note)
    VALUES (own_row.org_id,own_row.general_id,2026,'MD-SDNC-2026-L153-SFS432',
      'liable','new_construction',true,true,true,100,
      'Reference','Duplicate');
    RAISE EXCEPTION 'SDNC unique estimate constraint absent';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_sdnc_decisions
      (organization_id,general_estimate_id,fiscal_year,legal_version,mode,
       exclusion_reason,basis_note)
    VALUES (own_row.org_id,scratch_id,2027,'MD-SDNC-2026-L153-SFS432',
      'not_liable','public_budget','Unsupported future period');
    RAISE EXCEPTION 'Unsupported fiscal year was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_sdnc_decisions
      (organization_id,general_estimate_id,fiscal_year,legal_version,mode,
       exclusion_reason,basis_note)
    VALUES (own_row.org_id,scratch_id,2026,'old-or-forged',
      'not_liable','public_budget','Bad legislative source');
    RAISE EXCEPTION 'Unsupported legal version was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_sdnc_decisions
      (organization_id,general_estimate_id,fiscal_year,legal_version,mode,
       work_kind,permit_confirmed,non_public_funding_confirmed,
       not_exempt_house_confirmed,annual_eligible_investment_mdl,
       supporting_document,basis_note)
    VALUES (own_row.org_id,scratch_id,2026,'MD-SDNC-2026-L153-SFS432',
      'liable','new_construction',false,true,true,100,
      'Reference','Missing permit');
    RAISE EXCEPTION 'Unconfirmed permit was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_sdnc_decisions
      (organization_id,general_estimate_id,fiscal_year,legal_version,mode,
       work_kind,permit_confirmed,non_public_funding_confirmed,
       not_exempt_house_confirmed,annual_eligible_investment_mdl,
       supporting_document,basis_note)
    VALUES (own_row.org_id,scratch_id,2026,'MD-SDNC-2026-L153-SFS432',
      'liable','new_construction',true,true,true,-1,
      'Reference','Negative base');
    RAISE EXCEPTION 'Negative annual investment was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_sdnc_decisions
      (organization_id,general_estimate_id,fiscal_year,legal_version,mode,
       exclusion_reason,basis_note)
    VALUES (own_row.org_id,scratch_id,2026,'MD-SDNC-2026-L153-SFS432',
      'not_liable',null,'Without exclusion reason');
    RAISE EXCEPTION 'Empty exclusion reason was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.professional_sdnc_decisions
      (organization_id,general_estimate_id,fiscal_year,legal_version,mode,
       exclusion_reason,basis_note)
    VALUES (own_row.org_id,other_row.general_id,2026,'MD-SDNC-2026-L153-SFS432',
      'not_liable','public_budget','Wrong tenant estimate');
    RAISE EXCEPTION 'Composite org foreign key absent';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  INSERT INTO public.professional_sdnc_decisions
    (organization_id,general_estimate_id,fiscal_year,legal_version,
     mode,exclusion_reason,basis_note)
  VALUES (own_row.org_id,scratch_id,2026,'MD-SDNC-2026-L153-SFS432',
    'not_liable','public_budget','Confirmed public funding');

  IF EXISTS (SELECT 1 FROM public.professional_sdnc_decisions
      WHERE general_estimate_id=scratch_id AND annual_eligible_investment_mdl IS NOT NULL) THEN
    RAISE EXCEPTION 'Not-liable decision must have no annual base';
  END IF;
END
$$;

CREATE ROLE devizo_sdnc_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO devizo_sdnc_rls_test;
GRANT SELECT ON public.organization_members, sdnc_fixture TO devizo_sdnc_rls_test;
GRANT SELECT, INSERT, UPDATE ON public.professional_sdnc_decisions
  TO devizo_sdnc_rls_test;

SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM sdnc_fixture ORDER BY org_id LIMIT 1;
SET LOCAL ROLE devizo_sdnc_rls_test;

DO $$
DECLARE
  own_org uuid;
  other_org uuid;
  changed integer;
BEGIN
  SELECT org_id INTO own_org FROM sdnc_fixture WHERE actor_id=auth.uid() LIMIT 1;
  SELECT org_id INTO other_org FROM sdnc_fixture WHERE actor_id<>auth.uid() LIMIT 1;
  IF (SELECT count(*) FROM public.professional_sdnc_decisions
      WHERE organization_id=own_org) <> 2 THEN
    RAISE EXCEPTION 'Current member cannot see own SDNC decisions';
  END IF;
  IF EXISTS (SELECT 1 FROM public.professional_sdnc_decisions
      WHERE organization_id=other_org) THEN
    RAISE EXCEPTION 'Foreign SDNC decisions leaked';
  END IF;
  UPDATE public.professional_sdnc_decisions
    SET basis_note='Updated by own org'
    WHERE organization_id=own_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 2 THEN RAISE EXCEPTION 'Own SDNC decisions are not editable'; END IF;

  UPDATE public.professional_sdnc_decisions
    SET basis_note='Cross tenant write'
    WHERE organization_id=other_org;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Cross-tenant SDNC write permitted'; END IF;

  IF has_table_privilege(current_user,
    'public.professional_sdnc_decisions','DELETE') THEN
    RAISE EXCEPTION 'SDNC DELETE permission incorrectly granted';
  END IF;
END
$$;
RESET ROLE;
ROLLBACK;
