-- Recuperação genérica: recria entradas no caixa para recebíveis PAGO em maio/2026 sem movimento.
-- Não apaga entradas existentes. Execute no SQL Editor do Supabase.
-- Registros em «Aguardando faturamento» não são incluídos (dê baixa novamente pelo app).

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
  r.user_id,
  'RECEBER',
  r.id,
  r.valor,
  'Recuperação caixa — ' || COALESCE(v.placa, 'pátio'),
  COALESCE(
    (r.updated_at AT TIME ZONE 'America/Sao_Paulo')::date,
    (r.period_end AT TIME ZONE 'America/Sao_Paulo')::date,
    (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  ),
  COALESCE(r.forma_pagamento, 'PIX')
FROM receivables r
LEFT JOIN vehicles v ON v.id = r.vehicle_id AND v.user_id = r.user_id
WHERE r.status = 'PAGO'
  AND COALESCE(r.valor, 0) > 0
  AND COALESCE(
    (r.updated_at AT TIME ZONE 'America/Sao_Paulo')::date,
    (r.period_end AT TIME ZONE 'America/Sao_Paulo')::date,
    (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  ) >= '2026-05-01'::date
  AND COALESCE(
    (r.updated_at AT TIME ZONE 'America/Sao_Paulo')::date,
    (r.period_end AT TIME ZONE 'America/Sao_Paulo')::date,
    (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  ) < '2026-06-01'::date
  AND NOT EXISTS (
    SELECT 1
    FROM cash_movements cm
    WHERE cm.user_id = r.user_id
      AND cm.conta_id = r.id
      AND upper(cm.tipo_conta) IN ('RECEBER', 'ENTRADA')
  );

-- Conferência — total de entradas em maio/2026:
-- SELECT count(*) AS qtd, sum(valor) AS total
-- FROM cash_movements
-- WHERE upper(tipo_conta) IN ('RECEBER', 'ENTRADA')
--   AND data_movimento >= '2026-05-01'
--   AND data_movimento < '2026-06-01';
