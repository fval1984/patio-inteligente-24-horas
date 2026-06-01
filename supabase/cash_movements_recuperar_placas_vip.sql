-- Recuperação: 14 VW Polo VIP Leilões (VRP maio/2026) — pagamento confirmado sem entrada no caixa.
-- Execute DEPOIS de supabase/cash_movements.sql no SQL Editor do Supabase.
--
-- O que faz:
-- 1) Marca como PAGO o último ciclo encerrado de cada placa (se ainda não estiver).
-- 2) Insere movimento em cash_movements quando não existir.

WITH placas AS (
  SELECT unnest(
    ARRAY[
      'SNO9B38', 'SNO8G48', 'SNO9D08', 'SNO8G38', 'SNO7I98', 'SNO8H38', 'SNO8H58',
      'SNO8E98', 'SNO8C88', 'SNO8D68', 'SNO8G68', 'SNO7F38', 'SNO9A58', 'SNO8E38'
    ]
  ) AS placa_norm
),
veiculos AS (
  SELECT v.id AS vehicle_id, v.user_id, v.placa,
         upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'g')) AS placa_key
  FROM vehicles v
  INNER JOIN placas p ON upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'g')) = p.placa_norm
  WHERE v.status = 'REMOVIDO'
),
ciclos AS (
  SELECT DISTINCT ON (r.vehicle_id)
         r.id AS receivable_id,
         r.user_id,
         r.vehicle_id,
         r.valor,
         r.status,
         r.period_end,
         r.updated_at,
         v.placa
  FROM receivables r
  INNER JOIN veiculos v ON v.vehicle_id = r.vehicle_id AND v.user_id = r.user_id
  WHERE r.period_end IS NOT NULL
    AND COALESCE(r.valor, 0) > 0
  ORDER BY r.vehicle_id, r.period_end DESC, r.created_at DESC
),
marcados AS (
  UPDATE receivables r
  SET
    status = 'PAGO',
    financeiro_aprovado_contas_receber = COALESCE(financeiro_aprovado_contas_receber, true),
    updated_at = NOW()
  FROM ciclos c
  WHERE r.id = c.receivable_id
    AND r.status IS DISTINCT FROM 'PAGO'
  RETURNING r.id
)
INSERT INTO cash_movements (
  user_id,
  tipo_conta,
  conta_id,
  valor,
  descricao,
  data_movimento,
  forma_pagamento
)
SELECT
  c.user_id,
  'RECEBER',
  c.receivable_id,
  c.valor,
  'Recuperação caixa — ' || c.placa,
  COALESCE(c.period_end::date, c.updated_at::date, CURRENT_DATE),
  COALESCE(
    (SELECT r.forma_pagamento FROM receivables r WHERE r.id = c.receivable_id),
    'PIX'
  )
FROM ciclos c
WHERE NOT EXISTS (
  SELECT 1
  FROM cash_movements cm
  WHERE cm.user_id = c.user_id
    AND cm.conta_id = c.receivable_id
    AND upper(cm.tipo_conta) IN ('RECEBER', 'ENTRADA')
);

-- Conferência (deve listar 14 linhas com entrada no caixa):
-- SELECT v.placa, r.status, r.valor, r.period_end, cm.valor AS caixa_valor, cm.data_movimento
-- FROM vehicles v
-- JOIN receivables r ON r.vehicle_id = v.id AND r.period_end IS NOT NULL
-- LEFT JOIN cash_movements cm ON cm.conta_id = r.id AND upper(cm.tipo_conta) IN ('RECEBER','ENTRADA')
-- WHERE upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'g')) IN (
--   'SNO9B38','SNO8G48','SNO9D08','SNO8G38','SNO7I98','SNO8H38','SNO8H58',
--   'SNO8E98','SNO8C88','SNO8D68','SNO8G68','SNO7F38','SNO9A58','SNO8E38'
-- )
-- ORDER BY v.placa;
