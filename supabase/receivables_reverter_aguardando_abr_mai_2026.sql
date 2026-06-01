-- Corrigir VRP abr/mai 2026: pagamentos que saíram de «Contas a receber» sem caixa
-- → voltar para «Aguardando faturamento» (status AGUARDANDO_LANCAMENTO).
-- Casamento: placa + valor + data_saída + data_pagamento (desambigua VW Polo VIP).
-- Execute no SQL Editor do Supabase.

WITH entradas AS (
  SELECT * FROM (VALUES
    ('SHT9J35', 60::numeric, '2026-05-26'::date, '2026-05-29'::date),
    ('QLC1E25', 60, '2026-05-26', '2026-05-28'),
    ('CFZ3J00', 200, '2026-05-26', '2026-05-29'),
    ('PGQ3I89', 210, '2026-05-22', '2026-05-28'),
    ('SOK3G87', 105, '2026-05-22', '2026-05-29'),
    ('PDV8F14', 210, '2026-05-22', '2026-05-28'),
    ('PCC5J55', 120, '2026-05-21', '2026-05-25'),
    ('SOT1H11', 200, '2026-05-21', '2026-05-29'),
    ('SOP9J15', 105, '2026-05-20', '2026-05-26'),
    ('RUS0B38', 180, '2026-05-20', '2026-05-25'),
    ('SHB6H60', 30, '2026-05-19', '2026-05-19'),
    ('SOY9E09', 90, '2026-05-19', '2026-05-21'),
    ('PZO7C79', 330, '2026-05-18', '2026-05-29'),
    ('QLI9J77', 60, '2026-05-18', '2026-05-20'),
    ('UHM0A38', 250, '2026-05-16', '2026-05-25'),
    ('PDW3A12', 330, '2026-05-14', '2026-05-25'),
    ('SOH9F30', 140, '2026-05-13', '2026-05-27'),
    ('PCM9G77', 150, '2026-05-08', '2026-05-12'),
    ('QQN9E59', 60, '2026-05-07', '2026-05-08'),
    ('RNG8B19', 75, '2026-05-05', '2026-05-08'),
    ('PDR7B60', 90, '2026-05-05', '2026-05-08'),
    ('SOF0G64', 90, '2026-05-05', '2026-05-08'),
    ('RZK5J04', 90, '2026-05-05', '2026-05-08'),
    ('SOX5F86', 330, '2026-05-04', '2026-05-25'),
    ('SFV6B80', 800, '2026-05-03', '2026-05-11'),
    ('RTM1I82', 600, '2026-04-30', '2026-05-20'),
    ('QPO2F05', 150, '2026-04-30', '2026-05-04'),
    ('SNO9B38', 210, '2026-04-30', '2026-05-06'),
    ('SNO8G48', 240, '2026-04-30', '2026-05-08'),
    ('SNO9D08', 210, '2026-04-30', '2026-05-06'),
    ('SNO8G38', 240, '2026-04-30', '2026-05-08'),
    ('SNO7I98', 210, '2026-04-30', '2026-05-06'),
    ('SNO8H38', 210, '2026-04-30', '2026-05-06'),
    ('SNO8H58', 210, '2026-04-30', '2026-05-06'),
    ('SNO8E98', 210, '2026-04-30', '2026-05-06'),
    ('SNO8C88', 210, '2026-04-30', '2026-05-06'),
    ('SNO8D68', 210, '2026-04-30', '2026-05-06'),
    ('SNO8G68', 210, '2026-04-30', '2026-05-06'),
    ('SNO7F38', 210, '2026-04-30', '2026-05-06'),
    ('SNO9A58', 210, '2026-04-30', '2026-05-06'),
    ('SNO8E38', 210, '2026-04-30', '2026-05-06'),
    ('RZZ1J57', 150, '2026-04-29', '2026-05-04'),
    ('PGL3H13', 300, '2026-04-29', '2026-05-08'),
    ('HXR1I28', 240, '2026-04-28', '2026-05-06'),
    ('PDI2C97', 330, '2026-04-27', '2026-05-08'),
    ('PDM4C51', 240, '2026-04-27', '2026-05-05'),
    ('SOL5I69', 465, '2026-04-24', '2026-05-25'),
    ('RZV1B76', 360, '2026-04-24', '2026-05-05'),
    ('QYX2D91', 300, '2026-04-23', '2026-05-08'),
    ('QXM8G83', 630, '2026-04-15', '2026-05-06'),
    ('RII2H22', 690, '2026-04-14', '2026-05-29'),
    ('PDW8260', 375, '2026-04-09', '2026-05-04'),
    ('SNY4J16', 420, '2026-04-07', '2026-05-04'),
    ('SOQ9C44', 585, '2026-03-27', '2026-05-04'),
    ('RZS1C42', 960, '2026-03-23', '2026-05-25'),
    ('QYA5C45', 795, '2026-03-13', '2026-05-04'),
    ('SOW4G62', 795, '2026-03-13', '2026-05-04'),
    ('SNZ7F17', 900, '2026-03-06', '2026-05-04')
  ) AS t(placa_norm, valor_esperado, data_saida, data_pagamento)
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
    e.data_saida,
    e.data_pagamento,
    r.id AS receivable_id,
    r.user_id,
    r.status,
    r.vehicle_id,
    v.placa,
    row_number() OVER (
      PARTITION BY e.placa_norm, e.valor_esperado, e.data_saida, e.data_pagamento
      ORDER BY
        CASE WHEN r.status = 'PAGO' THEN 0 ELSE 1 END,
        abs(COALESCE(r.valor, 0) - e.valor_esperado),
        r.updated_at DESC NULLS LAST
    ) AS rn
  FROM entradas e
  INNER JOIN veiculos v ON v.placa_key = e.placa_norm
  INNER JOIN receivables r
    ON r.vehicle_id = v.vehicle_id
   AND r.user_id = v.user_id
   AND r.period_end IS NOT NULL
   AND COALESCE(r.valor, 0) > 0
   AND abs(COALESCE(r.valor, 0) - e.valor_esperado) < 0.01
   AND r.period_end::date = e.data_saida
   AND (
     (r.updated_at AT TIME ZONE 'America/Sao_Paulo')::date = e.data_pagamento
     OR r.updated_at::date = e.data_pagamento
     OR abs((r.updated_at AT TIME ZONE 'America/Sao_Paulo')::date - e.data_pagamento) <= 1
   )
),
ciclos AS (
  SELECT * FROM candidatos WHERE rn = 1 AND status = 'PAGO'
),
caixa_removido AS (
  DELETE FROM cash_movements cm
  USING ciclos c
  WHERE cm.user_id = c.user_id
    AND cm.conta_id = c.receivable_id
    AND upper(cm.tipo_conta) IN ('RECEBER', 'ENTRADA')
  RETURNING cm.id, cm.conta_id
),
revertidos AS (
  UPDATE receivables r
  SET
    status = 'AGUARDANDO_LANCAMENTO',
    financeiro_aprovado_contas_receber = false,
    patio_liberado_financeiro = true,
    updated_at = NOW()
  FROM ciclos c
  WHERE r.id = c.receivable_id
    AND r.status = 'PAGO'
  RETURNING r.id, c.placa, c.valor_esperado, c.data_saida
)
UPDATE vehicles v
SET payment_status = 'EM_ABERTO'
FROM ciclos c
WHERE v.id = c.vehicle_id
  AND v.user_id = c.user_id;

-- Conferência (~58 linhas em aguardando):
-- SELECT c.placa, c.valor_esperado, c.data_saida, r.status, r.financeiro_aprovado_contas_receber
-- FROM ciclos c
-- JOIN receivables r ON r.id = c.receivable_id;
