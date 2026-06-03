-- Zera o saldo do caixa por utilizador (entradas − saídas).
-- Executar no SQL Editor do Supabase. Não apaga movimentos anteriores.

WITH saldos AS (
  SELECT
    user_id,
    COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('RECEBER', 'ENTRADA') THEN valor ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('PAGAR', 'SAIDA', 'SAÍDA') THEN valor ELSE 0 END), 0) AS saldo
  FROM public.cash_movements
  GROUP BY user_id
)
INSERT INTO public.cash_movements (user_id, tipo_conta, conta_id, valor, descricao, data_movimento, forma_pagamento)
SELECT
  user_id,
  CASE WHEN saldo > 0 THEN 'SAIDA' ELSE 'ENTRADA' END,
  NULL,
  ROUND(ABS(saldo)::numeric, 2),
  'Ajuste — zerar saldo do caixa',
  CURRENT_DATE,
  'AJUSTE'
FROM saldos
WHERE ABS(saldo) > 0.005;
