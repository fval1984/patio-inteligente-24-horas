-- Cria saídas no caixa para contas a pagar já marcadas como PAGO sem movimento PAGAR/SAIDA.
-- Execute no SQL Editor do Supabase (após cash_movements.sql).

INSERT INTO public.cash_movements (user_id, tipo_conta, conta_id, valor, descricao, data_movimento, forma_pagamento)
SELECT
  p.user_id,
  'PAGAR',
  p.id,
  ROUND(p.valor::numeric, 2),
  COALESCE(NULLIF(TRIM(p.descricao), ''), NULLIF(TRIM(p.fornecedor), ''), 'Despesa'),
  COALESCE(p.data_vencimento::date, (p.updated_at AT TIME ZONE 'America/Sao_Paulo')::date, CURRENT_DATE),
  COALESCE(NULLIF(TRIM(p.forma_pagamento), ''), 'PIX')
FROM public.payables p
WHERE upper(coalesce(p.status, '')) = 'PAGO'
  AND coalesce(p.valor, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.cash_movements cm
    WHERE cm.user_id = p.user_id
      AND cm.conta_id = p.id
      AND upper(cm.tipo_conta) IN ('PAGAR', 'SAIDA', 'SAÍDA')
  );
