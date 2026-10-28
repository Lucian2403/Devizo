-- Reserve decisions belong exclusively to current organization members.
REVOKE DELETE ON TABLE public.professional_general_reserve_decisions
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.professional_general_reserve_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS professional_general_reserve_select_member ON public.professional_general_reserve_decisions;
CREATE POLICY professional_general_reserve_select_member
  ON public.professional_general_reserve_decisions FOR SELECT
  USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS professional_general_reserve_insert_member ON public.professional_general_reserve_decisions;
CREATE POLICY professional_general_reserve_insert_member
  ON public.professional_general_reserve_decisions FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));
DROP POLICY IF EXISTS professional_general_reserve_update_member ON public.professional_general_reserve_decisions;
CREATE POLICY professional_general_reserve_update_member
  ON public.professional_general_reserve_decisions FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
