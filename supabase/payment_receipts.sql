-- Recibo de pagamento (Financeiro → Entradas).
-- Não altera receivables, vehicles, partners, cash_movements nem o fluxo de caixa.
-- Guarda o documento emitido (snapshot) e o histórico de reemissão.

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

CREATE TABLE IF NOT EXISTS public.payment_receipt_counters (
  user_id uuid PRIMARY KEY,
  last_numero integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.payment_receipt_counters IS
  'Contador atômico do número do recibo, por proprietário dos dados.';

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  receivable_id uuid NOT NULL,
  vehicle_id uuid,
  numero text,
  status text NOT NULL DEFAULT 'PREVIA',
  token text NOT NULL,
  valor_total numeric(14, 2) NOT NULL DEFAULT 0,
  forma_pagamento text,
  placa_mascarada text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmado_por text,
  confirmado_user_id uuid,
  pagamento_em timestamptz,
  emitido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT payment_receipts_status_check CHECK (status IN ('PREVIA', 'PAGO'))
);

COMMENT ON TABLE public.payment_receipts IS
  'Recibo de pagamento emitido a partir de um lançamento de Entradas. O snapshot preserva os dados da emissão.';

CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_user_receivable_uidx
  ON public.payment_receipts (user_id, receivable_id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_token_uidx
  ON public.payment_receipts (token);

CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_user_numero_uidx
  ON public.payment_receipts (user_id, numero)
  WHERE numero IS NOT NULL AND btrim(numero) <> '';

CREATE INDEX IF NOT EXISTS payment_receipts_user_created_idx
  ON public.payment_receipts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_receipt_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.payment_receipts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  numero text,
  status text,
  snapshot jsonb NOT NULL,
  valor_total numeric(14, 2),
  alterado_por text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.payment_receipt_revisions IS
  'Cópia do recibo antes de cada reemissão. O documento anterior não é apagado.';

CREATE INDEX IF NOT EXISTS payment_receipt_revisions_receipt_idx
  ON public.payment_receipt_revisions (receipt_id, created_at DESC);

ALTER TABLE public.payment_receipt_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipt_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_receipts_select_own ON public.payment_receipts;
CREATE POLICY payment_receipts_select_own
  ON public.payment_receipts
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS payment_receipts_insert_own ON public.payment_receipts;
CREATE POLICY payment_receipts_insert_own
  ON public.payment_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS payment_receipts_update_own ON public.payment_receipts;
CREATE POLICY payment_receipts_update_own
  ON public.payment_receipts
  FOR UPDATE
  TO authenticated
  USING (public.patio_data_owner_match(user_id))
  WITH CHECK (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS payment_receipt_revisions_select_own ON public.payment_receipt_revisions;
CREATE POLICY payment_receipt_revisions_select_own
  ON public.payment_receipt_revisions
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS payment_receipt_revisions_insert_own ON public.payment_receipt_revisions;
CREATE POLICY payment_receipt_revisions_insert_own
  ON public.payment_receipt_revisions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.patio_data_owner_match(user_id));

-- O contador só é movido pela função abaixo (SECURITY DEFINER). Sem policy de escrita direta.

GRANT SELECT, INSERT, UPDATE ON public.payment_receipts TO authenticated;
GRANT SELECT, INSERT ON public.payment_receipt_revisions TO authenticated;

CREATE OR REPLACE FUNCTION public.next_payment_receipt_numero(p_user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF p_user IS NULL OR NOT public.patio_data_owner_match(p_user) THEN
    RAISE EXCEPTION 'sem permissão para numerar recibo';
  END IF;

  INSERT INTO public.payment_receipt_counters (user_id, last_numero)
  VALUES (p_user, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET last_numero = public.payment_receipt_counters.last_numero + 1
  RETURNING last_numero INTO n;

  RETURN lpad(n::text, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.next_payment_receipt_numero(uuid) IS
  'Próximo número de recibo, com bloqueio de linha. Não usar último+1 no aplicativo.';

REVOKE ALL ON FUNCTION public.next_payment_receipt_numero(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_payment_receipt_numero(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validar_recibo_pagamento(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.payment_receipts%ROWTYPE;
  data_txt text;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RETURN jsonb_build_object('autentico', false);
  END IF;

  SELECT * INTO r
  FROM public.payment_receipts
  WHERE token = btrim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('autentico', false);
  END IF;

  data_txt := to_char(
    COALESCE(r.pagamento_em, r.emitido_em, r.created_at) AT TIME ZONE 'America/Recife',
    'DD/MM/YYYY'
  );

  RETURN jsonb_build_object(
    'autentico', r.status = 'PAGO',
    'numero', COALESCE(r.numero, ''),
    'placa', COALESCE(r.placa_mascarada, ''),
    'data', COALESCE(data_txt, ''),
    'valor', r.valor_total,
    'status', CASE WHEN r.status = 'PAGO' THEN 'PAGO' ELSE 'AGUARDANDO PAGAMENTO' END
  );
END;
$$;

COMMENT ON FUNCTION public.validar_recibo_pagamento(text) IS
  'Conferência pública do recibo. Não devolve CPF, pagador, snapshot nem placa completa.';

REVOKE ALL ON FUNCTION public.validar_recibo_pagamento(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_recibo_pagamento(text) TO anon, authenticated;
