-- Reverter pagamentos confirmados (PAGO) para «Aguardando faturamento» — abr/mai 2026.
-- Casamento: placa + valor + data de SAÍDA (period_end) — mais confiável que data de pagamento.
-- Execute no SQL Editor do Supabase.

WITH entradas AS (
  SELECT * FROM (VALUES
    ('SHT9J35', 60::numeric, '2026-05-26'::date),
    ('QLC1E25', 60, '2026-05-26'),
    ('CFZ3J00', 200, '2026-05-26'),
    ('PGQ3I89', 210, '2026-05-22'),
    ('SOK3G87', 105, '2026-05-22'),
    ('PDV8F14', 210, '2026-05-22'),
    ('PCC5J55', 120, '2026-05-21'),
    ('SOT1H11', 200, '2026-05-21'),
    ('SOP9J15', 105, '2026-05-20'),
    ('RUS0B38', 180, '2026-05-20'),
    ('SHB6H60', 30, '2026-05-19'),
    ('SOY9E09', 90, '2026-05-19'),
    ('PZO7C79', 330, '2026-05-18'),
    ('QLI9J77', 60, '2026-05-18'),
    ('UHM0A38', 250, '2026-05-16'),
    ('PDW3A12', 330, '2026-05-14'),
    ('SOH9F30', 140, '2026-05-13'),
    ('PCM9G77', 150, '2026-05-08'),
    ('QQN9E59', 60, '2026-05-07'),
    ('RNG8B19', 75, '2026-05-05'),
    ('PDR7B60', 90, '2026-05-05'),
    ('SOF0G64', 90, '2026-05-05'),
    ('RZK5J04', 90, '2026-05-05'),
    ('SOX5F86', 330, '2026-05-04'),
    ('SFV6B80', 800, '2026-05-03'),
    ('RTM1I82', 600, '2026-04-30'),
    ('QPO2F05', 150, '2026-04-30'),
    ('SNO9B38', 210, '2026-04-30'),
    ('SNO8G48', 240, '2026-04-30'),
    ('SNO9D08', 210, '2026-04-30'),
    ('SNO8G38', 240, '2026-04-30'),
    ('SNO7I98', 210, '2026-04-30'),
    ('SNO8H38', 210, '2026-04-30'),
    ('SNO8H58', 210, '2026-04-30'),
    ('SNO8E98', 210, '2026-04-30'),
    ('SNO8C88', 210, '2026-04-30'),
    ('SNO8D68', 210, '2026-04-30'),
    ('SNO8G68', 210, '2026-04-30'),
    ('SNO7F38', 210, '2026-04-30'),
    ('SNO9A58', 210, '2026-04-30'),
    ('SNO8E38', 210, '2026-04-30'),
    ('RZZ1J57', 150, '2026-04-29'),
    ('PGL3H13', 300, '2026-04-29'),
    ('HXR1I28', 240, '2026-04-28'),
    ('PDI2C97', 330, '2026-04-27'),
    ('PDM4C51', 240, '2026-04-27'),
    ('SOL5I69', 465, '2026-04-24'),
    ('RZV1B76', 360, '2026-04-24'),
    ('QYX2D91', 300, '2026-04-23'),
    ('QXM8G83', 630, '2026-04-15'),
    ('RII2H22', 690, '2026-04-14'),
    ('PDW8260', 375, '2026-04-09'),
    ('SNY4J16', 420, '2026-04-07'),
    ('SOQ9C44', 585, '2026-03-27'),
    ('RZS1C42', 960, '2026-03-23'),
    ('QYA5C45', 795, '2026-03-13'),
    ('SOW4G62', 795, '2026-03-13'),
    ('SNZ7F17', 900, '2026-03-06')
  ) AS t(placa_norm, valor_esperado, data_saida)
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
    r.id AS receivable_id,
    r.user_id,
    r.status,
    v.placa,
    row_number() OVER (
      PARTITION BY e.placa_norm, e.valor_esperado, e.data_saida
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
)
UPDATE receivables r
SET
  status = 'AGUARDANDO_LANCAMENTO',
  financeiro_aprovado_contas_receber = false,
  patio_liberado_financeiro = true,
  updated_at = NOW()
FROM ciclos c
WHERE r.id = c.receivable_id
  AND r.status = 'PAGO';

-- Conferência:
-- SELECT c.placa, c.valor_esperado, c.data_saida, r.status
-- FROM ciclos c JOIN receivables r ON r.id = c.receivable_id;
