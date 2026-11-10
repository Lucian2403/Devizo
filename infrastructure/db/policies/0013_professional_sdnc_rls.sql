-- SDNC is organization-private. No DELETE privilege; corrections use upsert.
REVOKE DELETE ON TABLE public.professional_sdnc_decisions
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.professional_sdnc_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS professional_sdnc_select_member
  ON public.professional_sdnc_decisions;
CREATE POLICY professional_sdnc_select_member
  ON public.professional_sdnc_decisions FOR SELECT
  USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS professional_sdnc_insert_member
  ON public.professional_sdnc_decisions;
CREATE POLICY professional_sdnc_insert_member
  ON public.professional_sdnc_decisions FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));
DROP POLICY IF EXISTS professional_sdnc_update_member
  ON public.professional_sdnc_decisions;
CREATE POLICY professional_sdnc_update_member
  ON public.professional_sdnc_decisions FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
