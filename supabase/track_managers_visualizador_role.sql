-- Perfil VISUALIZADOR (somente leitura operacional, sem financeiro).
-- Idempotente. NÃO altera, apaga nem reescreve registros existentes.
-- Executar no Supabase → SQL Editor → Run.

ALTER TABLE public.track_managers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'GESTOR_PISTA';

ALTER TABLE public.track_managers DROP CONSTRAINT IF EXISTS track_managers_role_check;
ALTER TABLE public.track_managers ADD CONSTRAINT track_managers_role_check
  CHECK (role IN ('GESTOR_PISTA', 'OPERADOR_CADASTRO', 'VISTORIADOR', 'VISUALIZADOR'));

COMMENT ON COLUMN public.track_managers.role IS
  'GESTOR_PISTA = cadastro leve e consulta do pátio. VISTORIADOR = terminal exclusivo de vistoria. VISUALIZADOR = somente leitura, sem financeiro. OPERADOR_CADASTRO mantido só por compatibilidade.';

CREATE OR REPLACE FUNCTION public.auth_is_visualizador()
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
      AND tm.role = 'VISUALIZADOR'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_visualizador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_visualizador() TO authenticated;

-- Políticas RESTRICTIVE: somam-se às existentes (ADM, Gestor e Vistoriador inalterados).
CREATE OR REPLACE FUNCTION public._ampli_visualizador_lock_table(p_table regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  t text := p_table::text;
  pol text;
BEGIN
  IF p_table IS NULL THEN
    RETURN;
  END IF;
  pol := replace(split_part(t, '.', 2), '"', '') || '_visualizador_no_';
  IF split_part(t, '.', 2) = '' THEN
    pol := replace(t, '"', '') || '_visualizador_no_';
  END IF;

  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol || 'insert', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol || 'update', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol || 'delete', t);
  EXECUTE format(
    'CREATE POLICY %I ON %s AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.auth_is_visualizador())',
    pol || 'insert', t
  );
  EXECUTE format(
    'CREATE POLICY %I ON %s AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.auth_is_visualizador()) WITH CHECK (NOT public.auth_is_visualizador())',
    pol || 'update', t
  );
  EXECUTE format(
    'CREATE POLICY %I ON %s AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.auth_is_visualizador())',
    pol || 'delete', t
  );
END;
$$;

DO $$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'public.vehicles',
    'public.partners',
    'public.partner_managers',
    'public.advocacy_offices',
    'public.advocacy_office_managers',
    'public.advocacy_office_link_history',
    'public.vehicle_entry_inspections',
    'public.vehicle_entry_inspection_items',
    'public.vehicle_entry_inspection_damages',
    'public.vehicle_entry_inspection_photos',
    'public.receivables',
    'public.payables',
    'public.cash_movements',
    'public.cobrancas',
    'public.cobranca_itens',
    'public.patio_cycle_closures',
    'public.finance_contacts',
    'public.accounts_receivable',
    'public.daily_charges',
    'public.payments',
    'public.track_managers'
  ]
  LOOP
    IF to_regclass(rel) IS NOT NULL THEN
      PERFORM public._ampli_visualizador_lock_table(rel::regclass);
    END IF;
  END LOOP;
END $$;

-- Sem SELECT em tabelas financeiras (bloqueio não é só visual).
DO $$
DECLARE
  rel text;
  pol text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'public.receivables',
    'public.payables',
    'public.cash_movements',
    'public.cobrancas',
    'public.cobranca_itens',
    'public.patio_cycle_closures',
    'public.finance_contacts',
    'public.accounts_receivable',
    'public.daily_charges',
    'public.payments',
    'public.revenue',
    'public.revenue_deductions'
  ]
  LOOP
    IF to_regclass(rel) IS NULL THEN
      CONTINUE;
    END IF;
    pol := replace(split_part(rel, '.', 2), '"', '') || '_visualizador_no_select';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol, rel);
    EXECUTE format(
      'CREATE POLICY %I ON %s AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.auth_is_visualizador())',
      pol, rel
    );
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public._ampli_visualizador_lock_table(regclass);

NOTIFY pgrst, 'reload schema';
