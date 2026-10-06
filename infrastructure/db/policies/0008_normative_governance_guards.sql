CREATE OR REPLACE FUNCTION public.guard_normative_governance_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Normative governance history is append-only'
    USING ERRCODE = '55000';
END
$$;

DROP TRIGGER IF EXISTS normative_update_reviews_append_only
  ON public.normative_update_reviews;
CREATE TRIGGER normative_update_reviews_append_only
  BEFORE UPDATE OR DELETE ON public.normative_update_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_normative_governance_append_only();

DROP TRIGGER IF EXISTS normative_applicability_decisions_append_only
  ON public.normative_applicability_decisions;
CREATE TRIGGER normative_applicability_decisions_append_only
  BEFORE UPDATE OR DELETE ON public.normative_applicability_decisions
  FOR EACH ROW EXECUTE FUNCTION public.guard_normative_governance_append_only();

DROP TRIGGER IF EXISTS normative_source_relations_append_only
  ON public.normative_source_relations;
CREATE TRIGGER normative_source_relations_append_only
  BEFORE UPDATE OR DELETE ON public.normative_source_relations
  FOR EACH ROW EXECUTE FUNCTION public.guard_normative_governance_append_only();

CREATE OR REPLACE FUNCTION public.guard_normative_update_review_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  update_source_id uuid;
BEGIN
  SELECT source_id
    INTO update_source_id
    FROM public.normative_updates
   WHERE id = NEW.update_id
     AND organization_id = NEW.organization_id
   FOR SHARE;

  IF NOT FOUND OR update_source_id <> NEW.source_id THEN
    RAISE EXCEPTION 'Review source must match the detected update source'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS normative_update_reviews_validate_insert
  ON public.normative_update_reviews;
CREATE TRIGGER normative_update_reviews_validate_insert
  BEFORE INSERT ON public.normative_update_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_normative_update_review_insert();

CREATE OR REPLACE FUNCTION public.guard_normative_applicability_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_official_status text;
  update_source_id uuid;
  update_review_exists boolean;
BEGIN
  SELECT official_status
    INTO source_official_status
    FROM public.normative_sources
   WHERE id = NEW.source_id
     AND organization_id = NEW.organization_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Normative source does not belong to this organization'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.official_status <> source_official_status THEN
    RAISE EXCEPTION 'Applicability must snapshot the current official status'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.decision = 'applicable'
     AND (source_official_status <> 'in_force' OR NEW.applicable_from IS NULL) THEN
    RAISE EXCEPTION 'Only an in-force source with an explicit start date can be applicable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.triggering_update_id IS NOT NULL THEN
    SELECT source_id
      INTO update_source_id
      FROM public.normative_updates
     WHERE id = NEW.triggering_update_id
       AND organization_id = NEW.organization_id
     FOR SHARE;

    IF NOT FOUND OR update_source_id <> NEW.source_id THEN
      RAISE EXCEPTION 'Applicability update must belong to the same source'
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1
        FROM public.normative_update_reviews
       WHERE update_id = NEW.triggering_update_id
         AND organization_id = NEW.organization_id
    )
      INTO update_review_exists;
    IF NOT update_review_exists THEN
      RAISE EXCEPTION 'Review a detected update before deciding applicability'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS normative_applicability_validate_insert
  ON public.normative_applicability_decisions;
CREATE TRIGGER normative_applicability_validate_insert
  BEFORE INSERT ON public.normative_applicability_decisions
  FOR EACH ROW EXECUTE FUNCTION public.guard_normative_applicability_insert();

CREATE OR REPLACE FUNCTION public.guard_estimate_norm_version_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.publication_status <> 'draft' THEN
      RAISE EXCEPTION 'A normative version must start in draft'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.publication_status = 'published' THEN
    RAISE EXCEPTION 'A published normative version is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF OLD.publication_status <> 'draft'
     AND (to_jsonb(NEW) - 'publication_status' - 'updated_at')
         IS DISTINCT FROM
         (to_jsonb(OLD) - 'publication_status' - 'updated_at') THEN
    RAISE EXCEPTION 'Return a normative version to draft before editing its contents'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.publication_status IS DISTINCT FROM OLD.publication_status
     AND NOT (
       (OLD.publication_status = 'draft' AND NEW.publication_status = 'in_review')
       OR (OLD.publication_status = 'in_review' AND NEW.publication_status IN ('draft', 'approved'))
       OR (OLD.publication_status = 'approved' AND NEW.publication_status IN ('in_review', 'published'))
     ) THEN
    RAISE EXCEPTION 'Invalid normative publication status transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS estimate_norm_versions_publication_guard
  ON public.estimate_norm_versions;
CREATE TRIGGER estimate_norm_versions_publication_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_norm_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_estimate_norm_version_publication();

CREATE OR REPLACE FUNCTION public.guard_published_estimate_norm_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.estimate_norm_versions
     WHERE estimate_norm_id = OLD.id
       AND organization_id = OLD.organization_id
       AND publication_status = 'published'
  ) THEN
    RAISE EXCEPTION 'An estimate norm with published versions is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS estimate_norms_published_identity_guard
  ON public.estimate_norms;
CREATE TRIGGER estimate_norms_published_identity_guard
  BEFORE UPDATE OR DELETE ON public.estimate_norms
  FOR EACH ROW EXECUTE FUNCTION public.guard_published_estimate_norm_identity();

CREATE OR REPLACE FUNCTION public.guard_published_norm_consumptions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_id uuid;
  version_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    version_id := OLD.estimate_norm_version_id;
    SELECT publication_status
      INTO version_status
      FROM public.estimate_norm_versions
     WHERE id = version_id
     FOR UPDATE;
    IF version_status = 'published' THEN
      RAISE EXCEPTION 'Resource consumptions for a published normative version are immutable'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    version_id := NEW.estimate_norm_version_id;
    SELECT publication_status
      INTO version_status
      FROM public.estimate_norm_versions
     WHERE id = version_id
     FOR UPDATE;
    IF version_status = 'published' THEN
      RAISE EXCEPTION 'Resource consumptions for a published normative version are immutable'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS resource_consumptions_published_version_guard
  ON public.resource_consumptions;
CREATE TRIGGER resource_consumptions_published_version_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.resource_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_published_norm_consumptions();
