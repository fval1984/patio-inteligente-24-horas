-- Perfil VISTORIADOR (terminal de vistoria + identificação individual).
-- Idempotente. NÃO altera, apaga nem reescreve registros existentes.
-- Executar no Supabase → SQL Editor → Run.

ALTER TABLE public.track_managers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'GESTOR_PISTA';

ALTER TABLE public.track_managers DROP CONSTRAINT IF EXISTS track_managers_role_check;
ALTER TABLE public.track_managers ADD CONSTRAINT track_managers_role_check
  CHECK (role IN ('GESTOR_PISTA', 'OPERADOR_CADASTRO', 'VISTORIADOR'));

COMMENT ON COLUMN public.track_managers.role IS
  'GESTOR_PISTA = cadastro leve e consulta do pátio. VISTORIADOR = terminal exclusivo de vistoria. OPERADOR_CADASTRO mantido só por compatibilidade.';

DO $$
BEGIN
  IF to_regclass('public.vehicle_entry_inspections') IS NOT NULL THEN
    EXECUTE 'COMMENT ON COLUMN public.vehicle_entry_inspections.completed_by_user_id IS ''ID único do utilizador que realizou a vistoria (vistoriador_id). Não usar o utilizador da sessão do tablet.''';
    EXECUTE 'COMMENT ON COLUMN public.vehicle_entry_inspections.completed_by_name IS ''Nome de exibição do vistoriador autenticado (PDF/impressão). O vínculo principal é completed_by_user_id.''';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.auth_is_vistoriador()
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
      AND tm.role = 'VISTORIADOR'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_vistoriador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_vistoriador() TO authenticated;

-- Políticas RESTRICTIVE: somam-se às existentes (ADM e Gestor de pista inalterados).
DO $$
BEGIN
  IF to_regclass('public.vehicles') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS vehicles_vistoriador_no_insert ON public.vehicles';
  EXECUTE 'DROP POLICY IF EXISTS vehicles_vistoriador_no_update ON public.vehicles';
  EXECUTE 'DROP POLICY IF EXISTS vehicles_vistoriador_no_delete ON public.vehicles';
  EXECUTE $p$
    CREATE POLICY vehicles_vistoriador_no_insert
      ON public.vehicles
      AS RESTRICTIVE
      FOR INSERT
      TO authenticated
      WITH CHECK (NOT public.auth_is_vistoriador())
  $p$;
  EXECUTE $p$
    CREATE POLICY vehicles_vistoriador_no_update
      ON public.vehicles
      AS RESTRICTIVE
      FOR UPDATE
      TO authenticated
      USING (NOT public.auth_is_vistoriador())
      WITH CHECK (NOT public.auth_is_vistoriador())
  $p$;
  EXECUTE $p$
    CREATE POLICY vehicles_vistoriador_no_delete
      ON public.vehicles
      AS RESTRICTIVE
      FOR DELETE
      TO authenticated
      USING (NOT public.auth_is_vistoriador())
  $p$;
END $$;

NOTIFY pgrst, 'reload schema';
