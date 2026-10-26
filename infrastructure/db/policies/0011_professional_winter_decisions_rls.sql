-- Every winter decision belongs to an organization. No DELETE is granted.
REVOKE DELETE ON TABLE public.professional_winter_decisions
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.professional_winter_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS professional_winter_decisions_select_member
  ON public.professional_winter_decisions;
CREATE POLICY professional_winter_decisions_select_member
  ON public.professional_winter_decisions FOR SELECT
  USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS professional_winter_decisions_insert_member
  ON public.professional_winter_decisions;
CREATE POLICY professional_winter_decisions_insert_member
  ON public.professional_winter_decisions FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));
DROP POLICY IF EXISTS professional_winter_decisions_update_member
  ON public.professional_winter_decisions;
CREATE POLICY professional_winter_decisions_update_member
  ON public.professional_winter_decisions FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
