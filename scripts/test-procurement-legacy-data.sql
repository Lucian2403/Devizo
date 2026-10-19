CREATE TEMP TABLE procurement_legacy_fixture AS
SELECT gen_random_uuid() AS org_id, gen_random_uuid() AS actor_id,
  gen_random_uuid() AS source_id, gen_random_uuid() AS resource_id,
  gen_random_uuid() AS price_id, gen_random_uuid() AS object_id,
  gen_random_uuid() AS list_id, gen_random_uuid() AS context_id
FROM generate_series(1, 2);

INSERT INTO auth.users (id) SELECT actor_id FROM procurement_legacy_fixture;
INSERT INTO public.organizations (id, name, slug)
  SELECT org_id, 'M8.4D legacy fixture', org_id::text FROM procurement_legacy_fixture;
INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT org_id, actor_id, 'owner' FROM procurement_legacy_fixture;
INSERT INTO public.normative_sources
  (id, organization_id, code, title, edition, source_type)
  SELECT source_id, org_id, 'LEGACY', 'Technical test source', '1', 'company_custom'
  FROM procurement_legacy_fixture;
INSERT INTO public.professional_resources
  (id, organization_id, source_id, code, name, resource_type, unit)
  SELECT resource_id, org_id, source_id, 'MAT-LEGACY', 'Legacy material', 'material', 'kg'
  FROM procurement_legacy_fixture;
INSERT INTO public.resource_prices
  (id, organization_id, resource_id, price, basis_quantity, currency, valid_from, source_type)
  SELECT price_id, org_id, resource_id, 1200, 100, 'MDL', '2026-01-01', 'manual'
  FROM procurement_legacy_fixture;
INSERT INTO public.construction_objects (id, organization_id, name)
  SELECT object_id, org_id, 'Legacy object' FROM procurement_legacy_fixture;
INSERT INTO public.work_quantity_lists (id, organization_id, construction_object_id, name)
  SELECT list_id, org_id, object_id, 'Legacy list' FROM procurement_legacy_fixture;
INSERT INTO public.calculation_contexts
  (id, organization_id, construction_object_id, work_quantity_list_id, name, valuation_date, currency)
  SELECT context_id, org_id, object_id, list_id, 'Legacy context', '2026-06-15', 'MDL'
  FROM procurement_legacy_fixture;
