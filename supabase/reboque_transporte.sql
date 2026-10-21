-- Reboque e Transporte, dentro do módulo Parceiros.
-- Idempotente. Não altera vehicles, payables, cash_movements, receivables
-- nem o fluxo de pátio (VNP, VSL, VSC, VRP, vistoria).
-- Executar no Supabase → SQL Editor → Run.
-- Empresas e autônomos continuam na tabela partners (tipos EMPRESA_REBOQUE e REBOQUEIRO_AUTONOMO).
-- Motoristas, caminhões, serviços, valores e pagamentos ficam nas tabelas abaixo.
-- Dados bancários e documentos não entram no JSON público de partners.

CREATE OR REPLACE FUNCTION public.patio_data_owner_match(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_owner IS NOT NULL AND (
    auth.uid() = p_owner
    OR EXISTS (
      SELECT 1
      FROM public.track_managers tm
      WHERE tm.user_id = auth.uid()
        AND tm.owner_user_id = p_owner
    )
  );
$$;

DO $do$
BEGIN
  IF to_regprocedure('public.auth_is_visualizador()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.auth_is_visualizador()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$ SELECT false $body$
    $fn$;
  END IF;
  IF to_regprocedure('public.auth_is_gestor_pista()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.auth_is_gestor_pista()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$ SELECT false $body$
    $fn$;
  END IF;
  IF to_regprocedure('public.auth_is_vistoriador()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.auth_is_vistoriador()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$ SELECT false $body$
    $fn$;
  END IF;
END
$do$;

CREATE TABLE IF NOT EXISTS public.tow_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_partner_id uuid NOT NULL REFERENCES public.partners (id) ON DELETE RESTRICT,
  nome text NOT NULL,
  cpf text,
  cpf_digits text NOT NULL DEFAULT '',
  telefone text,
  whatsapp text,
  cnh text,
  cnh_categoria text,
  cnh_validade date,
  habitual_truck_id uuid,
  observacoes text,
  status text NOT NULL DEFAULT 'ATIVO',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT tow_drivers_status_check CHECK (status IN ('ATIVO', 'INATIVO'))
);

CREATE TABLE IF NOT EXISTS public.tow_trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  owner_partner_id uuid NOT NULL REFERENCES public.partners (id) ON DELETE RESTRICT,
  placa text NOT NULL,
  placa_norm text NOT NULL DEFAULT '',
  marca text,
  modelo text,
  ano text,
  tipo_equipamento text,
  capacidade_obs text,
  status text NOT NULL DEFAULT 'ATIVO',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT tow_trucks_status_check CHECK (status IN ('ATIVO', 'INATIVO'))
);

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tow_drivers_habitual_truck_fkey'
  ) THEN
    ALTER TABLE public.tow_drivers
      ADD CONSTRAINT tow_drivers_habitual_truck_fkey
      FOREIGN KEY (habitual_truck_id) REFERENCES public.tow_trucks (id) ON DELETE SET NULL;
  END IF;
END
$do$;

CREATE TABLE IF NOT EXISTS public.tow_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles (id) ON DELETE RESTRICT,
  placa_veiculo text,
  data_remocao timestamptz NOT NULL DEFAULT timezone('utc', now()),
  origem text,
  destino text,
  tipo_prestador text NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.partners (id) ON DELETE RESTRICT,
  partner_nome text NOT NULL,
  driver_id uuid REFERENCES public.tow_drivers (id) ON DELETE RESTRICT,
  driver_nome text,
  truck_id uuid REFERENCES public.tow_trucks (id) ON DELETE RESTRICT,
  truck_placa text,
  observacoes text,
  cancelado boolean NOT NULL DEFAULT false,
  registrado_por text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT tow_services_tipo_check CHECK (tipo_prestador IN ('EMPRESA', 'AUTONOMO'))
);

CREATE TABLE IF NOT EXISTS public.tow_service_finance (
  service_id uuid PRIMARY KEY REFERENCES public.tow_services (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  valor_contratado numeric(14, 2),
  aprovado boolean NOT NULL DEFAULT false,
  payable_id uuid,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.tow_service_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.tow_services (id) ON DELETE RESTRICT,
  valor numeric(14, 2) NOT NULL,
  data_pagamento date NOT NULL,
  forma_pagamento text,
  favorecido_nome text,
  comprovante_ref text,
  usuario text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT tow_service_payments_valor_check CHECK (valor > 0)
);

CREATE TABLE IF NOT EXISTS public.tow_partner_banking (
  partner_id uuid PRIMARY KEY REFERENCES public.partners (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  inscricao_estadual text,
  banco text,
  agencia text,
  conta text,
  tipo_conta text,
  chave_pix text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.tow_partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners (id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  path text,
  url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $do$
BEGIN
  IF to_regclass('public.payables') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'tow_service_finance_payable_fkey'
     ) THEN
    ALTER TABLE public.tow_service_finance
      ADD CONSTRAINT tow_service_finance_payable_fkey
      FOREIGN KEY (payable_id) REFERENCES public.payables (id) ON DELETE SET NULL;
  END IF;
END
$do$;

CREATE UNIQUE INDEX IF NOT EXISTS tow_drivers_user_cpf_uidx
  ON public.tow_drivers (user_id, cpf_digits)
  WHERE cpf_digits <> '';

CREATE UNIQUE INDEX IF NOT EXISTS tow_trucks_user_placa_uidx
  ON public.tow_trucks (user_id, placa_norm)
  WHERE placa_norm <> '';

CREATE UNIQUE INDEX IF NOT EXISTS tow_service_finance_payable_uidx
  ON public.tow_service_finance (payable_id)
  WHERE payable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tow_drivers_company_idx
  ON public.tow_drivers (user_id, company_partner_id, status);

CREATE INDEX IF NOT EXISTS tow_trucks_owner_idx
  ON public.tow_trucks (user_id, owner_partner_id, status);

CREATE INDEX IF NOT EXISTS tow_services_partner_idx
  ON public.tow_services (user_id, partner_id, data_remocao DESC);

CREATE INDEX IF NOT EXISTS tow_services_vehicle_idx
  ON public.tow_services (vehicle_id);

CREATE INDEX IF NOT EXISTS tow_services_driver_idx
  ON public.tow_services (driver_id);

CREATE INDEX IF NOT EXISTS tow_services_truck_idx
  ON public.tow_services (truck_id);

CREATE INDEX IF NOT EXISTS tow_service_payments_service_idx
  ON public.tow_service_payments (service_id, data_pagamento);

COMMENT ON TABLE public.tow_drivers IS
  'Motoristas operacionais de empresas de reboque. Não são contas de usuário e não geram obrigação financeira própria.';
COMMENT ON TABLE public.tow_services IS
  'Serviço de transporte com snapshot do prestador, motorista e caminhão. O histórico não acompanha renomeações posteriores.';
COMMENT ON TABLE public.tow_service_finance IS
  'Valor contratado e vínculo único com uma conta a pagar. Sem payable_id não há obrigação financeira.';

CREATE OR REPLACE FUNCTION public.tow_block_delete_with_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'tow_drivers' THEN
    IF EXISTS (SELECT 1 FROM public.tow_services s WHERE s.driver_id = OLD.id) THEN
      RAISE EXCEPTION 'Motorista possui remoções registradas. Inative o cadastro em vez de excluir.';
    END IF;
  ELSIF TG_TABLE_NAME = 'tow_trucks' THEN
    IF EXISTS (SELECT 1 FROM public.tow_services s WHERE s.truck_id = OLD.id) THEN
      RAISE EXCEPTION 'Caminhão possui remoções registradas. Inative o cadastro em vez de excluir.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tow_drivers_block_delete ON public.tow_drivers;
CREATE TRIGGER trg_tow_drivers_block_delete
  BEFORE DELETE ON public.tow_drivers
  FOR EACH ROW
  EXECUTE PROCEDURE public.tow_block_delete_with_history();

DROP TRIGGER IF EXISTS trg_tow_trucks_block_delete ON public.tow_trucks;
CREATE TRIGGER trg_tow_trucks_block_delete
  BEFORE DELETE ON public.tow_trucks
  FOR EACH ROW
  EXECUTE PROCEDURE public.tow_block_delete_with_history();

CREATE OR REPLACE FUNCTION public.tow_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  svc public.tow_services%ROWTYPE;
  fin public.tow_service_finance%ROWTYPE;
  pago numeric(14, 2);
BEGIN
  SELECT * INTO svc FROM public.tow_services WHERE id = NEW.service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço de remoção não encontrado.';
  END IF;
  IF svc.cancelado THEN
    RAISE EXCEPTION 'Serviço cancelado não aceita pagamento.';
  END IF;
  IF svc.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Pagamento precisa pertencer ao mesmo pátio do serviço.';
  END IF;
  SELECT * INTO fin FROM public.tow_service_finance WHERE service_id = NEW.service_id;
  IF NOT FOUND OR NOT COALESCE(fin.aprovado, false) OR COALESCE(fin.valor_contratado, 0) <= 0 OR fin.payable_id IS NULL THEN
    RAISE EXCEPTION 'Pagamento só é permitido depois da obrigação financeira aprovada.';
  END IF;
  SELECT COALESCE(SUM(valor), 0) INTO pago
  FROM public.tow_service_payments
  WHERE service_id = NEW.service_id
    AND id IS DISTINCT FROM NEW.id;
  IF pago + NEW.valor > fin.valor_contratado + 0.009 THEN
    RAISE EXCEPTION 'O pagamento ultrapassa o saldo do serviço.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tow_payment_guard ON public.tow_service_payments;
CREATE TRIGGER trg_tow_payment_guard
  BEFORE INSERT OR UPDATE ON public.tow_service_payments
  FOR EACH ROW
  EXECUTE PROCEDURE public.tow_payment_guard();

ALTER TABLE public.tow_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tow_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tow_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tow_service_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tow_service_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tow_partner_banking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tow_partner_documents ENABLE ROW LEVEL SECURITY;

-- Cadastros operacionais: leitura do pátio; escrita só do administrador do pátio.
DROP POLICY IF EXISTS tow_drivers_select ON public.tow_drivers;
CREATE POLICY tow_drivers_select ON public.tow_drivers
  FOR SELECT TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS tow_drivers_write ON public.tow_drivers;
CREATE POLICY tow_drivers_write ON public.tow_drivers
  FOR ALL TO authenticated
  USING (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  )
  WITH CHECK (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  );

DROP POLICY IF EXISTS tow_trucks_select ON public.tow_trucks;
CREATE POLICY tow_trucks_select ON public.tow_trucks
  FOR SELECT TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS tow_trucks_write ON public.tow_trucks;
CREATE POLICY tow_trucks_write ON public.tow_trucks
  FOR ALL TO authenticated
  USING (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  )
  WITH CHECK (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  );

-- Serviço operacional: gestor pode registrar no fluxo do veículo; não edita nem apaga.
DROP POLICY IF EXISTS tow_services_select ON public.tow_services;
CREATE POLICY tow_services_select ON public.tow_services
  FOR SELECT TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS tow_services_insert ON public.tow_services;
CREATE POLICY tow_services_insert ON public.tow_services
  FOR INSERT TO authenticated
  WITH CHECK (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_vistoriador()
  );

DROP POLICY IF EXISTS tow_services_update ON public.tow_services;
CREATE POLICY tow_services_update ON public.tow_services
  FOR UPDATE TO authenticated
  USING (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  )
  WITH CHECK (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  );

DROP POLICY IF EXISTS tow_services_delete ON public.tow_services;
CREATE POLICY tow_services_delete ON public.tow_services
  FOR DELETE TO authenticated
  USING (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  );

-- Financeiro: invisível para visualizador, gestor de pista e vistoriador.
DROP POLICY IF EXISTS tow_service_finance_all ON public.tow_service_finance;
CREATE POLICY tow_service_finance_all ON public.tow_service_finance
  FOR ALL TO authenticated
  USING (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  )
  WITH CHECK (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  );

DROP POLICY IF EXISTS tow_service_payments_all ON public.tow_service_payments;
CREATE POLICY tow_service_payments_all ON public.tow_service_payments
  FOR ALL TO authenticated
  USING (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  )
  WITH CHECK (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  );

DROP POLICY IF EXISTS tow_partner_banking_all ON public.tow_partner_banking;
CREATE POLICY tow_partner_banking_all ON public.tow_partner_banking
  FOR ALL TO authenticated
  USING (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  )
  WITH CHECK (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  );

DROP POLICY IF EXISTS tow_partner_documents_all ON public.tow_partner_documents;
CREATE POLICY tow_partner_documents_all ON public.tow_partner_documents
  FOR ALL TO authenticated
  USING (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  )
  WITH CHECK (
    public.patio_data_owner_match(user_id)
    AND NOT public.auth_is_visualizador()
    AND NOT public.auth_is_gestor_pista()
    AND NOT public.auth_is_vistoriador()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tow_drivers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tow_trucks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tow_services TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tow_service_finance TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tow_service_payments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tow_partner_banking TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tow_partner_documents TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
