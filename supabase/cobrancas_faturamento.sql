-- Fatura única (cobrança agrupada) e pagamentos parciais.
-- Não altera receivables, vehicles, partners, payables nem cash_movements.
-- Cobranças já gravadas ficam como HISTORICO: continuam consultáveis e não bloqueiam novo faturamento.
-- Execute no SQL Editor do Supabase.

ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS valor_recebido numeric(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS cliente_modo text NOT NULL DEFAULT 'cadastrado';
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS cliente_documento text;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS cliente_contato text;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS identificador text;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'financeiro';
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS busca_texto text;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS data_vencimento date;

UPDATE public.cobrancas
SET status = 'HISTORICO'
WHERE status IS NULL OR btrim(status) = '';

ALTER TABLE public.cobrancas ALTER COLUMN status SET DEFAULT 'PENDENTE';
ALTER TABLE public.cobrancas ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobrancas_origem_check') THEN
    ALTER TABLE public.cobrancas DROP CONSTRAINT cobrancas_origem_check;
  END IF;
  ALTER TABLE public.cobrancas
    ADD CONSTRAINT cobrancas_origem_check
    CHECK (parceiro_origem IN ('partner', 'advocacy_office', 'avulso'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobrancas_status_check') THEN
    ALTER TABLE public.cobrancas
      ADD CONSTRAINT cobrancas_status_check
      CHECK (status IN ('PENDENTE', 'PARCIAL', 'PAGO', 'HISTORICO'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobrancas_cliente_modo_check') THEN
    ALTER TABLE public.cobrancas
      ADD CONSTRAINT cobrancas_cliente_modo_check
      CHECK (cliente_modo IN ('cadastrado', 'avulso'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_user_identificador_uidx
  ON public.cobrancas (user_id, identificador)
  WHERE identificador IS NOT NULL;

CREATE INDEX IF NOT EXISTS cobrancas_user_status_idx
  ON public.cobrancas (user_id, status, numero_cobranca DESC);

DROP POLICY IF EXISTS cobrancas_update_own ON public.cobrancas;
CREATE POLICY cobrancas_update_own
  ON public.cobrancas
  FOR UPDATE
  TO authenticated
  USING (public.patio_data_owner_match(user_id))
  WITH CHECK (public.patio_data_owner_match(user_id));

GRANT UPDATE ON public.cobrancas TO authenticated;

CREATE TABLE IF NOT EXISTS public.cobranca_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas (id) ON DELETE CASCADE,
  valor numeric(14, 2) NOT NULL CHECK (valor > 0),
  forma text NOT NULL DEFAULT 'PIX',
  data_pagamento date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.cobranca_pagamentos IS
  'Pagamentos (PIX ou outra forma) de uma fatura. Não altera o valor original dos veículos.';

CREATE INDEX IF NOT EXISTS cobranca_pagamentos_cobranca_idx
  ON public.cobranca_pagamentos (cobranca_id, created_at DESC);

ALTER TABLE public.cobranca_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cobranca_pagamentos_select_own ON public.cobranca_pagamentos;
CREATE POLICY cobranca_pagamentos_select_own
  ON public.cobranca_pagamentos
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS cobranca_pagamentos_insert_own ON public.cobranca_pagamentos;
CREATE POLICY cobranca_pagamentos_insert_own
  ON public.cobranca_pagamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.patio_data_owner_match(user_id));

GRANT SELECT, INSERT ON public.cobranca_pagamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_pagamentos TO service_role;

NOTIFY pgrst, 'reload schema';
