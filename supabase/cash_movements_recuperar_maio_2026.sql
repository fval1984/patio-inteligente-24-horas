-- Recuperação: VRP maio/2026 — 45 saídas com valor > 0 (lista completa do pátio).
-- Execute DEPOIS de supabase/cash_movements.sql no SQL Editor do Supabase.
--
-- Casamento por placa + valor + data. SNO8E38: dois ciclos RPP distintos (João Vitor R$20 abr/26 + VIP R$210 mai/26).
-- Ignora SIZ4F67 e RZL2H53 (R$ 0,00).

WITH entradas AS (
  SELECT * FROM (VALUES
    ('RUQ7G54', 50::numeric, '2026-05-28'::date),
    ('SHT9J35', 60, '2026-05-29'),
    ('QLC1E25', 60, '2026-05-28'),
    ('CFZ3J00', 200, '2026-05-29'),
    ('PGQ3I89', 210, '2026-05-28'),
    ('SOK3G87', 105, '2026-05-29'),
    ('PDV8F14', 210, '2026-05-28'),
    ('PCC5J55', 120, '2026-05-25'),
    ('SOT1H11', 200, '2026-05-29'),
    ('SOP9J15', 105, '2026-05-26'),
    ('RUS0B38', 180, '2026-05-25'),
    ('SHB6H60', 30, '2026-05-19'),
    ('SOY9E09', 90, '2026-05-21'),
    ('PZO7C79', 330, '2026-05-29'),
    ('QLI9J77', 60, '2026-05-20'),
    ('UHM0A38', 250, '2026-05-25'),
    ('PDW3A12', 330, '2026-05-25'),
    ('SOH9F30', 140, '2026-05-27'),
    ('PCM9G77', 150, '2026-05-12'),
    ('QQN9E59', 60, '2026-05-08'),
    ('RNG8B19', 75, '2026-05-08'),
    ('PDR7B60', 90, '2026-05-08'),
    ('SOF0G64', 90, '2026-05-08'),
    ('RZK5J04', 90, '2026-05-08'),
    ('SOX5F86', 330, '2026-05-25'),
    ('SFV6B80', 800, '2026-05-11'),
    ('RTM1I82', 600, '2026-05-20'),
    ('QPO2F05', 150, '2026-05-04'),
    ('SNO9B38', 210, '2026-05-06'),
    ('SNO8G48', 240, '2026-05-08'),
    ('SNO9D08', 210, '2026-05-06'),
    ('SNO8G38', 240, '2026-05-08'),
    ('SNO7I98', 210, '2026-05-06'),
    ('SNO8H38', 210, '2026-05-06'),
    ('SNO8H58', 210, '2026-05-06'),
    ('SNO8E98', 210, '2026-05-06'),
    ('SNO8C88', 210, '2026-05-06'),
    ('SNO8D68', 210, '2026-05-06'),
    ('SNO8G68', 210, '2026-05-06'),
    ('SNO7F38', 210, '2026-05-06'),
    ('SNO9A58', 210, '2026-05-06'),
    ('SNO8E38', 20, '2026-04-30'),
    ('SNO8E38', 210, '2026-05-06'),
    ('RZZ1J57', 150, '2026-05-04'),
    ('PGL3H13', 300, '2026-05-08'),
    ('HXR1I28', 240, '2026-05-06')
  ) AS t(placa_norm, valor_esperado, data_pagamento)
),
veiculos AS (
  SELECT v.id AS vehicle_id, v.user_id, v.placa,
         upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'g')) AS placa_key
  FROM vehicles v
  INNER JOIN entradas e
    ON upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'g')) = e.placa_norm
),
candidatos AS (
  SELECT
    e.placa_norm,
    e.valor_esperado,
    e.data_pagamento,
    r.id AS receivable_id,
    r.user_id,
    r.vehicle_id,
    r.valor,
    r.status,
    r.period_end,
    r.updated_at,
    v.placa,
    row_number() OVER (
      PARTITION BY e.placa_norm, e.valor_esperado, e.data_pagamento
      ORDER BY
        CASE WHEN r.status = 'PAGO' THEN 0 ELSE 1 END,
        abs(COALESCE(r.valor, 0) - e.valor_esperado),
        r.period_end DESC NULLS LAST,
        r.created_at DESC
    ) AS rn
  FROM entradas e
  INNER JOIN veiculos v ON v.placa_key = e.placa_norm
  INNER JOIN receivables r
    ON r.vehicle_id = v.vehicle_id
   AND r.user_id = v.user_id
   AND r.period_end IS NOT NULL
   AND COALESCE(r.valor, 0) > 0
   AND abs(COALESCE(r.valor, 0) - e.valor_esperado) < 0.01
),
ciclos AS (
  SELECT * FROM candidatos WHERE rn = 1
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
  c.valor_esperado,
  'Recuperação caixa — ' || c.placa,
  c.data_pagamento,
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

-- Conferência: deve retornar 45 linhas com caixa_valor preenchido.
-- SELECT e.placa_norm, e.valor_esperado, e.data_pagamento, cm.valor AS caixa_valor, cm.data_movimento
-- FROM (VALUES ...) -- ou join com entradas acima
-- LEFT JOIN ...

-- Resumo por competência (maio/2026):
-- SELECT sum(cm.valor) AS total_maio
-- FROM cash_movements cm
-- WHERE upper(cm.tipo_conta) IN ('RECEBER', 'ENTRADA')
--   AND cm.data_movimento >= '2026-05-01'
--   AND cm.data_movimento < '2026-06-01';
