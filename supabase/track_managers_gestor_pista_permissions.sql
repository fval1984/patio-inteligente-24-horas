-- Gestor de pista: mesmas restrições de escrita do Visualizador,
-- excepto INSERT de veículos e UPDATE só para saída física VSC → VRP.
-- Idempotente. NÃO altera nem apaga registros existentes.
-- Executar no Supabase → SQL Editor → Run.

CREATE OR REPLACE FUNCTION public.auth_is_gestor_pista()
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
      AND tm.role IN ('GESTOR_PISTA', 'OPERADOR_CADASTRO')
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_gestor_pista() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_gestor_pista() TO authenticated;

CREATE OR REPLACE FUNCTION public._ampli_gestor_lock_writes(p_table regclass)
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
  pol := replace(split_part(t, '.', 2), '"', '') || '_gestor_no_';
  IF split_part(t, '.', 2) = '' THEN
    pol := replace(t, '"', '') || '_gestor_no_';
  END IF;
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol || 'insert', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol || 'update', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol || 'delete', t);
  EXECUTE format(
    'CREATE POLICY %I ON %s AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.auth_is_gestor_pista())',
    pol || 'insert', t
  );
  EXECUTE format(
    'CREATE POLICY %I ON %s AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.auth_is_gestor_pista()) WITH CHECK (NOT public.auth_is_gestor_pista())',
    pol || 'update', t
  );
  EXECUTE format(
    'CREATE POLICY %I ON %s AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.auth_is_gestor_pista())',
    pol || 'delete', t
  );
END;
$$;

DO $$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'public.partners',
    'public.partner_managers',
    'public.advocacy_offices',
    'public.advocacy_office_managers',
    'public.advocacy_office_link_history',
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
      PERFORM public._ampli_gestor_lock_writes(rel::regclass);
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public._ampli_gestor_lock_table(regclass);
DROP FUNCTION IF EXISTS public._ampli_gestor_lock_writes(regclass);

-- Veículos: gestor pode criar entrada; não pode apagar; update só VSC → VRP.
DO $$
BEGIN
  IF to_regclass('public.vehicles') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS vehicles_gestor_no_delete ON public.vehicles';
  EXECUTE $p$
    CREATE POLICY vehicles_gestor_no_delete
      ON public.vehicles
      AS RESTRICTIVE
      FOR DELETE
      TO authenticated
      USING (NOT public.auth_is_gestor_pista())
  $p$;

  EXECUTE 'DROP POLICY IF EXISTS vehicles_gestor_update_vsc_exit_only ON public.vehicles';
  EXECUTE $p$
    CREATE POLICY vehicles_gestor_update_vsc_exit_only
      ON public.vehicles
      AS RESTRICTIVE
      FOR UPDATE
      TO authenticated
      USING (
        NOT public.auth_is_gestor_pista()
        OR upper(status::text) IN ('LIBERACAO_CONFIRMADA', 'REMOCAO_CONFIRMADA')
      )
      WITH CHECK (
        NOT public.auth_is_gestor_pista()
        OR (
          upper(status::text) = 'REMOVIDO'
          AND data_saida IS NOT NULL
        )
      )
  $p$;
END $$;

-- Impede o gestor de alterar outros campos ao confirmar a saída (VSC → VRP).
CREATE OR REPLACE FUNCTION public.vehicles_gestor_pista_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_is_gestor_pista() THEN
    RETURN NEW;
  END IF;
  IF upper(COALESCE(OLD.status::text, '')) NOT IN ('LIBERACAO_CONFIRMADA', 'REMOCAO_CONFIRMADA') THEN
    RAISE EXCEPTION 'Gestor de pista só pode confirmar a saída física de veículos no VSC';
  END IF;
  IF upper(COALESCE(NEW.status::text, '')) <> 'REMOVIDO' OR NEW.data_saida IS NULL THEN
    RAISE EXCEPTION 'Gestor de pista só pode movimentar o veículo de VSC para VRP com data de saída';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicles_gestor_pista_update_guard ON public.vehicles;
CREATE TRIGGER trg_vehicles_gestor_pista_update_guard
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE PROCEDURE public.vehicles_gestor_pista_update_guard();

-- Histórico: gestor pode incluir eventos; não pode editar nem apagar.
DO $$
BEGIN
  IF to_regclass('public.vehicle_events') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS vehicle_events_gestor_no_update ON public.vehicle_events';
  EXECUTE $p$
    CREATE POLICY vehicle_events_gestor_no_update
      ON public.vehicle_events
      AS RESTRICTIVE
      FOR UPDATE
      TO authenticated
      USING (NOT public.auth_is_gestor_pista())
      WITH CHECK (NOT public.auth_is_gestor_pista())
  $p$;
  EXECUTE 'DROP POLICY IF EXISTS vehicle_events_gestor_no_delete ON public.vehicle_events';
  EXECUTE $p$
    CREATE POLICY vehicle_events_gestor_no_delete
      ON public.vehicle_events
      AS RESTRICTIVE
      FOR DELETE
      TO authenticated
      USING (NOT public.auth_is_gestor_pista())
  $p$;
END $$;

-- Sem SELECT em tabelas financeiras.
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
    pol := replace(split_part(rel, '.', 2), '"', '') || '_gestor_no_select';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol, rel);
    EXECUTE format(
      'CREATE POLICY %I ON %s AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.auth_is_gestor_pista())',
      pol, rel
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
