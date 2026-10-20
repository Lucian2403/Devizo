-- Organization isolation for live professional general estimates.
-- No DELETE policy is provided; associations are excluded instead.
DO $$
DECLARE
  table_name text;
  professional_tables text[] := ARRAY[
    'professional_general_estimates',
    'professional_general_estimate_entries'
  ];
BEGIN
  EXECUTE 'REVOKE DELETE ON TABLE public.professional_general_estimates, public.professional_general_estimate_entries FROM PUBLIC, anon, authenticated, service_role';

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
