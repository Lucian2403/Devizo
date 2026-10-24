-- Keep one official temporary-work rule row per source and rule code.
-- Earlier PR30 builds could duplicate all 47 rows when the same NCM source was
-- verified against another applicability revision.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.professional_general_rule_definitions a
    JOIN public.professional_general_rule_definitions b
      ON b.organization_id = a.organization_id
     AND b.source_id = a.source_id
     AND b.component = a.component
     AND b.rule_code = a.rule_code
     AND b.id > a.id
    WHERE a.component = 'temporary_works'
      AND (
        b.group_code IS DISTINCT FROM a.group_code
        OR b.group_label IS DISTINCT FROM a.group_label
        OR b.name IS DISTINCT FROM a.name
        OR b.value_type IS DISTINCT FROM a.value_type
        OR b.value IS DISTINCT FROM a.value
        OR b.valid_from IS DISTINCT FROM a.valid_from
        OR b.valid_to IS DISTINCT FROM a.valid_to
        OR b.source_reference IS DISTINCT FROM a.source_reference
      )
  ) THEN
    RAISE EXCEPTION
      'Conflicting duplicate temporary-work rules exist; refusing automatic pack repair';
  END IF;
END
$$;
--> statement-breakpoint

CREATE TEMP TABLE temporary_work_rule_dedup ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    r.id,
    first_value(r.id) OVER (
      PARTITION BY r.organization_id, r.source_id, r.component, r.rule_code
      ORDER BY
        CASE WHEN EXISTS (
          SELECT 1
          FROM public.professional_general_cost_decisions d
          WHERE d.rule_definition_id = r.id
        ) THEN 0 ELSE 1 END,
        r.created_at,
        r.id
    ) AS keep_id
  FROM public.professional_general_rule_definitions r
  WHERE r.component = 'temporary_works'
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE id <> keep_id;
--> statement-breakpoint

UPDATE public.professional_general_cost_decisions d
SET rule_definition_id = x.keep_id,
    updated_at = now()
FROM temporary_work_rule_dedup x
WHERE d.rule_definition_id = x.duplicate_id;
--> statement-breakpoint

DELETE FROM public.professional_general_rule_definitions r
USING temporary_work_rule_dedup x
WHERE r.id = x.duplicate_id;
--> statement-breakpoint

ALTER TABLE public.professional_general_rule_definitions
  DROP CONSTRAINT IF EXISTS professional_general_rules_pack_slot_unique;
--> statement-breakpoint

ALTER TABLE public.professional_general_rule_definitions
  ADD CONSTRAINT professional_general_rules_pack_rule_unique
  UNIQUE (organization_id, source_id, component, rule_code);
