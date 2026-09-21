-- RLS for the professional resource-based estimate domain (M8.0).
-- Every professional row is organization-owned. Direct client access is limited
-- to members of that organization. DELETE is intentionally not granted here;
-- historical/normative records should not be casually hard-deleted.
-- Safe to run more than once.

DO $$
DECLARE
  table_name text;
  professional_tables text[] := ARRAY[
    'construction_objects',
    'work_quantity_lists',
    'work_quantity_items',
    'normative_sources',
    'estimate_norms',
    'estimate_norm_versions',
    'professional_resources',
    'resource_consumptions',
    'resource_prices',
    'calculation_contexts',
    'norm_applications',
    'calculation_rules'
  ];
BEGIN
  FOREACH table_name IN ARRAY professional_tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      table_name || '_select_member',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_org_member(organization_id))',
      table_name || '_select_member',
      table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      table_name || '_insert_member',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_org_member(organization_id))',
      table_name || '_insert_member',
      table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      table_name || '_update_member',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))',
      table_name || '_update_member',
      table_name
    );
  END LOOP;
END
$$;
