-- Permite ao gestor de pista e ao vistoriador LER vistorias do dono do pátio.
-- Sem isto, a finalização grava (API com service role) mas a lista do gestor fica sem bola verde.
-- Idempotente. Não altera nem apaga registros.

CREATE OR REPLACE FUNCTION public.auth_is_patio_delegate_of(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.track_managers tm
    WHERE tm.user_id = auth.uid()
      AND tm.owner_user_id = p_owner
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_patio_delegate_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_patio_delegate_of(uuid) TO authenticated;

DROP POLICY IF EXISTS vehicle_entry_inspections_delegate_select ON public.vehicle_entry_inspections;
CREATE POLICY vehicle_entry_inspections_delegate_select
  ON public.vehicle_entry_inspections
  FOR SELECT
  TO authenticated
  USING (public.auth_is_patio_delegate_of(user_id));

DROP POLICY IF EXISTS vehicle_entry_inspection_items_delegate_select ON public.vehicle_entry_inspection_items;
CREATE POLICY vehicle_entry_inspection_items_delegate_select
  ON public.vehicle_entry_inspection_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehicle_entry_inspections i
      WHERE i.id = inspection_id AND public.auth_is_patio_delegate_of(i.user_id)
    )
  );

DROP POLICY IF EXISTS vehicle_entry_inspection_damages_delegate_select ON public.vehicle_entry_inspection_damages;
CREATE POLICY vehicle_entry_inspection_damages_delegate_select
  ON public.vehicle_entry_inspection_damages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehicle_entry_inspections i
      WHERE i.id = inspection_id AND public.auth_is_patio_delegate_of(i.user_id)
    )
  );

DROP POLICY IF EXISTS vehicle_entry_inspection_photos_delegate_select ON public.vehicle_entry_inspection_photos;
CREATE POLICY vehicle_entry_inspection_photos_delegate_select
  ON public.vehicle_entry_inspection_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehicle_entry_inspections i
      WHERE i.id = inspection_id AND public.auth_is_patio_delegate_of(i.user_id)
    )
  );

NOTIFY pgrst, 'reload schema';
