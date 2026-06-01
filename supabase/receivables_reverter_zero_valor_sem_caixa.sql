-- Pagos (PAGO) com valor zerado e sem caixa → Aguardando faturamento.
-- Recalcule valores depois pelo app («Corrigir pagos R$ 0 sem caixa») ou confira diárias manualmente.
-- Casamento: placa + data_saída + data_pagamento.

WITH entradas AS (
  SELECT * FROM (VALUES
    ('QLC1E25', '2026-05-28'::date, '2026-06-01'::date),
    ('QYP9F00', '2026-04-02', '2026-05-28'),
    ('QPO2F05', '2026-05-04', '2026-05-28'),
    ('QQN9E59', '2026-05-08', '2026-05-28'),
    ('SHB6H60', '2026-05-19', '2026-05-28'),
    ('KKY4389', '2026-04-13', '2026-05-28'),
    ('QKQ9348', '2026-04-29', '2026-05-28'),
    ('SNZ7F17', '2026-05-04', '2026-05-28'),
    ('SOW4G62', '2026-05-04', '2026-05-28'),
    ('QYA5C45', '2026-05-04', '2026-05-28'),
    ('SOQ9C44', '2026-05-04', '2026-05-28'),
    ('SNY4J16', '2026-05-04', '2026-05-28'),
    ('PDW8260', '2026-05-04', '2026-05-28'),
    ('UHM8D60', '2026-04-28', '2026-05-28'),
    ('SNN5A22', '2026-04-30', '2026-05-28'),
    ('SIZ4F67', '2026-05-28', '2026-05-28'),
    ('FCI1J96', '2026-03-26', '2026-05-28'),
    ('PGR8747', '2026-03-25', '2026-05-28'),
    ('PCG7556', '2026-02-20', '2026-05-28'),
    ('PDY4F95', '2026-05-04', '2026-05-28'),
    ('PDW9D44', '2026-03-04', '2026-05-28'),
    ('RTL3G87', '2026-04-20', '2026-05-28'),
    ('PDA8420', '2026-04-20', '2026-05-28'),
    ('QYR1E87', '2026-04-16', '2026-05-28'),
    ('QQK8J81', '2026-03-10', '2026-05-28'),
    ('DSF7D74', '2026-02-05', '2026-05-28'),
    ('SNO8E38', '2026-04-30', '2026-05-28'),
    ('SNO9A58', '2026-04-30', '2026-05-28'),
    ('SNO8G68', '2026-04-30', '2026-05-28'),
    ('SNO7F38', '2026-04-30', '2026-05-28'),
    ('SNO8D68', '2026-04-30', '2026-05-28'),
    ('SNO8C88', '2026-04-30', '2026-05-28'),
    ('SNO8E98', '2026-04-30', '2026-05-28'),
    ('SNO8H58', '2026-04-30', '2026-05-28'),
    ('SNO7I98', '2026-04-30', '2026-05-28'),
    ('SNO8H38', '2026-04-30', '2026-05-28'),
    ('SNO8G38', '2026-04-30', '2026-05-28'),
    ('SNO8G48', '2026-04-30', '2026-05-28'),
    ('SNO9B38', '2026-04-30', '2026-05-28'),
    ('SNO8G38', '2026-05-08', '2026-05-28'),
    ('SNO9B38', '2026-05-06', '2026-05-28'),
    ('SNO9D08', '2026-05-06', '2026-05-28'),
    ('SNO7I98', '2026-05-06', '2026-05-28'),
    ('SNO8H58', '2026-05-06', '2026-05-28'),
    ('SNO8D68', '2026-05-06', '2026-05-28'),
    ('SNO7F38', '2026-05-06', '2026-05-28'),
    ('SNO9A58', '2026-05-06', '2026-05-28'),
    ('SNO8E38', '2026-05-06', '2026-05-28'),
    ('SNO8E98', '2026-05-06', '2026-05-28'),
    ('SNO8C88', '2026-05-06', '2026-05-28'),
    ('SNO8H38', '2026-05-06', '2026-05-28'),
    ('SNO8G68', '2026-05-06', '2026-05-28'),
    ('SNO8G48', '2026-05-08', '2026-05-28'),
    ('SUH6B38', '2026-03-24', '2026-05-28'),
    ('RZQ8E78', '2026-02-20', '2026-05-28'),
    ('RUV2E49', '2026-03-03', '2026-05-28'),
    ('PEC2H21', '2026-02-20', '2026-05-28'),
    ('MZE8942', '2026-03-03', '2026-05-28'),
    ('NME8J96', '2026-03-03', '2026-05-28'),
    ('PFZ0A85', '2026-03-03', '2026-05-28'),
    ('PFS0240', '2026-03-03', '2026-05-28'),
    ('RZQ8B88', '2026-04-16', '2026-05-28'),
    ('SHU2G14', '2026-04-10', '2026-05-28'),
    ('QYT3D79', '2026-04-06', '2026-05-28'),
    ('END3I82', '2026-03-25', '2026-05-28'),
    ('RZL7E72', '2026-04-02', '2026-05-28'),
    ('SHB8A03', '2026-04-29', '2026-05-26'),
    ('QYW3D26', '2026-04-23', '2026-05-26'),
    ('RFW4F34', '2026-04-23', '2026-05-26'),
    ('PGQ2H63', '2026-04-23', '2026-05-26'),
    ('RTM1I82', '2026-05-20', '2026-05-20'),
    ('SFV6B80', '2026-05-11', '2026-05-11'),
    ('QYE7E85', '2026-05-04', '2026-05-08')
  ) AS t(placa_norm, data_saida, data_pagamento)
),
veiculos AS (
  SELECT v.id AS vehicle_id, v.user_id, v.placa,
         upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'g')) AS placa_key
  FROM vehicles v
  INNER JOIN entradas e ON upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'g')) = e.placa_norm
),
candidatos AS (
  SELECT
    e.placa_norm, e.data_saida, e.data_pagamento,
    r.id AS receivable_id, r.user_id, r.vehicle_id, r.status, v.placa,
    row_number() OVER (
      PARTITION BY e.placa_norm, e.data_saida, e.data_pagamento
      ORDER BY r.updated_at DESC NULLS LAST
    ) AS rn
  FROM entradas e
  INNER JOIN veiculos v ON v.placa_key = e.placa_norm
  INNER JOIN receivables r ON r.vehicle_id = v.vehicle_id AND r.user_id = v.user_id
   AND r.period_end IS NOT NULL
   AND COALESCE(r.valor, 0) < 0.01
   AND r.period_end::date = e.data_saida
   AND (
     (r.updated_at AT TIME ZONE 'America/Sao_Paulo')::date = e.data_pagamento
     OR r.updated_at::date = e.data_pagamento
     OR abs((r.updated_at AT TIME ZONE 'America/Sao_Paulo')::date - e.data_pagamento) <= 1
   )
),
ciclos AS (SELECT * FROM candidatos WHERE rn = 1 AND status = 'PAGO'),
caixa_removido AS (
  DELETE FROM cash_movements cm USING ciclos c
  WHERE cm.user_id = c.user_id AND cm.conta_id = c.receivable_id
    AND upper(cm.tipo_conta) IN ('RECEBER', 'ENTRADA')
  RETURNING cm.id
)
UPDATE receivables r
SET status = 'AGUARDANDO_LANCAMENTO',
    financeiro_aprovado_contas_receber = false,
    patio_liberado_financeiro = true,
    updated_at = NOW()
FROM ciclos c
WHERE r.id = c.receivable_id AND r.status = 'PAGO';
