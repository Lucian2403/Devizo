-- Structural regression for the additive M8.5C2B1 change.
-- Installed against a disposable PostgreSQL database by test:normative:db.
DO $$
DECLARE
  rule_component_check text;
  policy_count integer;
  unique_count integer;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO rule_component_check
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'professional_general_rule_definitions'
    AND c.conname = 'professional_general_rules_component_check';

  IF rule_component_check IS NULL
    OR position('temporary_works' IN rule_component_check) = 0
    OR position('winter_conditions' IN rule_component_check) = 0
  THEN
    RAISE EXCEPTION 'Normative rule component CHECK must accept both supported types';
  END IF;

  SELECT COUNT(*) INTO unique_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'professional_general_rule_definitions'
    AND c.conname = 'professional_general_rules_pack_rule_unique'
    AND c.contype = 'u';
  IF unique_count <> 1 THEN
    RAISE EXCEPTION 'Winter/temporary rule pack uniqueness guarantee is missing';
  END IF;

  IF NOT (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.professional_general_rule_definitions'::regclass
  ) THEN
    RAISE EXCEPTION 'Normative general rules must have RLS enabled';
  END IF;

  SELECT COUNT(*) INTO policy_count FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'professional_general_rule_definitions'
    AND policyname IN (
      'professional_general_rule_definitions_select_member',
      'professional_general_rule_definitions_insert_member',
      'professional_general_rule_definitions_update_member'
    );
  IF policy_count <> 3 THEN
    RAISE EXCEPTION 'Member SELECT/INSERT/UPDATE policies are required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'professional_general_rule_definitions'
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'Normative rules must not permit DELETE through an RLS policy';
  END IF;
END
$$;
