-- Reuse the existing protected normative-rule table for winter conditions.
-- The old temporary-works rows, decisions, foreign keys and RLS are unchanged.
ALTER TABLE public.professional_general_rule_definitions
  DROP CONSTRAINT professional_general_rules_component_check;
--> statement-breakpoint
ALTER TABLE public.professional_general_rule_definitions
  ADD CONSTRAINT professional_general_rules_component_check
  CHECK (component IN ('temporary_works', 'winter_conditions'));
