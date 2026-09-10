-- Histórico documental do módulo Cobrança.
-- Idempotente. NÃO altera receivables, vehicles, partners, payables, cash_movements
-- nem qualquer registro financeiro existente.
-- Estas tabelas apenas registram qual documento foi gerado (PDF), sem criar débito.

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

CREATE TABLE IF NOT EXISTS public.cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  parceiro_origem text NOT NULL DEFAULT 'partner',
  parceiro_id uuid,
  advocacy_office_id uuid,
  parceiro_nome text,
  parceiro_tipo text,
  numero_cobranca integer NOT NULL,
  data_geracao timestamptz NOT NULL DEFAULT timezone('utc', now()),
  periodo_inicio date,
  periodo_fim date,
  quantidade_veiculos integer NOT NULL DEFAULT 0,
  valor_total numeric(14, 2) NOT NULL DEFAULT 0,
  usuario_id uuid,
  usuario_email text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.cobrancas IS
  'Histórico de documentos de cobrança gerados. Não substitui receivables nem cria débito financeiro.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobrancas_origem_check'
  ) THEN
    ALTER TABLE public.cobrancas
      ADD CONSTRAINT cobrancas_origem_check
      CHECK (parceiro_origem IN ('partner', 'advocacy_office'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_user_numero_uidx
  ON public.cobrancas (user_id, numero_cobranca);

CREATE INDEX IF NOT EXISTS cobrancas_user_parceiro_idx
  ON public.cobrancas (user_id, parceiro_id, data_geracao DESC);

CREATE INDEX IF NOT EXISTS cobrancas_user_escritorio_idx
  ON public.cobrancas (user_id, advocacy_office_id, data_geracao DESC);

CREATE TABLE IF NOT EXISTS public.cobranca_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas (id) ON DELETE CASCADE,
  receivable_id uuid,
  vehicle_id uuid,
  valor numeric(14, 2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.cobranca_itens IS
  'Itens do documento de cobrança (referência ao lançamento original + snapshot de impressão).';

CREATE UNIQUE INDEX IF NOT EXISTS cobranca_itens_cobranca_receivable_uidx
  ON public.cobranca_itens (cobranca_id, receivable_id)
  WHERE receivable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cobranca_itens_cobranca_idx
  ON public.cobranca_itens (cobranca_id);

CREATE INDEX IF NOT EXISTS cobranca_itens_receivable_idx
  ON public.cobranca_itens (receivable_id);

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cobrancas_select_own ON public.cobrancas;
CREATE POLICY cobrancas_select_own
  ON public.cobrancas
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS cobrancas_insert_own ON public.cobrancas;
CREATE POLICY cobrancas_insert_own
  ON public.cobrancas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS cobranca_itens_select_own ON public.cobranca_itens;
CREATE POLICY cobranca_itens_select_own
  ON public.cobranca_itens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cobrancas c
      WHERE c.id = cobranca_id
        AND public.patio_data_owner_match(c.user_id)
    )
  );

DROP POLICY IF EXISTS cobranca_itens_insert_own ON public.cobranca_itens;
CREATE POLICY cobranca_itens_insert_own
  ON public.cobranca_itens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.cobrancas c
      WHERE c.id = cobranca_id
        AND public.patio_data_owner_match(c.user_id)
    )
  );

GRANT SELECT, INSERT ON public.cobrancas TO authenticated;
GRANT SELECT, INSERT ON public.cobranca_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_itens TO service_role;

NOTIFY pgrst, 'reload schema';
