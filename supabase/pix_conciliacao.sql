-- Conciliação PIX (somente leitura sobre receivables existentes).
-- Idempotente. NÃO altera vehicles, receivables, cash_movements nem registros já pagos.

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

CREATE TABLE IF NOT EXISTS public.pix_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  data_recebimento date NOT NULL,
  valor numeric(14, 2) NOT NULL CHECK (valor > 0),
  pagador_nome text,
  txid text,
  observacao text,
  origem text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.pix_recebimentos IS
  'PIX conferidos manualmente. Preparado para importação futura de extrato. Não dá baixa sozinho.';

CREATE UNIQUE INDEX IF NOT EXISTS pix_recebimentos_user_txid_uidx
  ON public.pix_recebimentos (user_id, lower(btrim(txid)))
  WHERE txid IS NOT NULL AND btrim(txid) <> '';

CREATE INDEX IF NOT EXISTS pix_recebimentos_user_data_idx
  ON public.pix_recebimentos (user_id, data_recebimento DESC);

CREATE TABLE IF NOT EXISTS public.pix_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  pix_id uuid NOT NULL REFERENCES public.pix_recebimentos (id) ON DELETE CASCADE,
  receivable_id uuid,
  cobranca_id uuid,
  valor numeric(14, 2) NOT NULL CHECK (valor > 0),
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.pix_alocacoes IS
  'Vínculo de um PIX a um ou vários títulos/cobranças (pagamento parcial permitido).';

CREATE INDEX IF NOT EXISTS pix_alocacoes_pix_idx ON public.pix_alocacoes (pix_id);
CREATE INDEX IF NOT EXISTS pix_alocacoes_receivable_idx ON public.pix_alocacoes (receivable_id);

CREATE TABLE IF NOT EXISTS public.pix_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  pix_id uuid,
  acao text NOT NULL,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_email text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.pix_recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pix_recebimentos_all_own ON public.pix_recebimentos;
CREATE POLICY pix_recebimentos_all_own ON public.pix_recebimentos
  FOR ALL TO authenticated
  USING (public.patio_data_owner_match(user_id))
  WITH CHECK (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS pix_alocacoes_all_own ON public.pix_alocacoes;
CREATE POLICY pix_alocacoes_all_own ON public.pix_alocacoes
  FOR ALL TO authenticated
  USING (public.patio_data_owner_match(user_id))
  WITH CHECK (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS pix_auditoria_select_own ON public.pix_auditoria;
CREATE POLICY pix_auditoria_select_own ON public.pix_auditoria
  FOR SELECT TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS pix_auditoria_insert_own ON public.pix_auditoria;
CREATE POLICY pix_auditoria_insert_own ON public.pix_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (public.patio_data_owner_match(user_id));

NOTIFY pgrst, 'reload schema';
