-- Diagnóstico read-only: VRP sem Aguardando Faturamento
-- Execute no SQL Editor do Supabase (somente SELECT)

-- 1) Placas específicas
SELECT
  v.id AS vehicle_id,
  v.placa,
  v.status AS status_veiculo,
  v.data_entrada,
  v.data_saida,
  v.remocao_solicitada,
  v.remocao_solicitada_em,
  v.updated_at AS veiculo_updated_at
FROM public.vehicles v
WHERE upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'gi')) IN ('PCG0I26', 'PZO7C240', 'PZO7C24');

-- 2) Eventos de workflow (saída / liberação)
SELECT
  v.placa,
  ve.tipo,
  ve.responsavel,
  ve.descricao,
  ve.created_at
FROM public.vehicle_events ve
JOIN public.vehicles v ON v.id = ve.vehicle_id
WHERE upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'gi')) IN ('PCG0I26', 'PZO7C240', 'PZO7C24')
ORDER BY ve.created_at DESC;

-- 3) Recebíveis vinculados
SELECT
  v.placa,
  r.id AS receivable_id,
  r.status AS receivable_status,
  r.valor,
  r.period_start,
  r.period_end,
  r.patio_liberado_financeiro,
  r.financeiro_aprovado_contas_receber,
  r.updated_at,
  r.created_at
FROM public.receivables r
JOIN public.vehicles v ON v.id = r.vehicle_id
WHERE upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'gi')) IN ('PCG0I26', 'PZO7C240', 'PZO7C24')
ORDER BY r.created_at DESC;

-- 4) Fechamentos de ciclo (patio_cycle_closures)
SELECT
  v.placa,
  pcc.receivable_id,
  pcc.period_start,
  pcc.period_end,
  pcc.valor,
  pcc.triagem_ok,
  pcc.sent_to_finance,
  pcc.created_at
FROM public.patio_cycle_closures pcc
JOIN public.vehicles v ON v.id = pcc.vehicle_id
WHERE upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'gi')) IN ('PCG0I26', 'PZO7C240', 'PZO7C24')
ORDER BY pcc.created_at DESC;

-- 5) Casos semelhantes: REMOVIDO recente sem receivable encerrado
SELECT
  v.placa,
  v.data_saida,
  v.status,
  r.id AS receivable_id,
  r.status AS receivable_status,
  r.valor,
  r.period_end,
  r.financeiro_aprovado_contas_receber,
  CASE
    WHEN r.id IS NULL THEN 'SEM_RECEIVABLE'
    WHEN r.status = 'PAGO' AND coalesce(r.valor, 0) = 0 THEN 'ENCERRADO_SEM_COBRANCA'
    WHEN r.financeiro_aprovado_contas_receber IS TRUE AND r.status = 'EM_ABERTO' THEN 'CONTAS_A_RECEBER'
    WHEN r.status = 'AGUARDANDO_LANCAMENTO' THEN 'AGUARDANDO_FATURAMENTO'
    WHEN r.status = 'EM_ABERTO' AND r.period_end IS NOT NULL AND coalesce(r.financeiro_aprovado_contas_receber, false) = false THEN 'AGUARDANDO_FATURAMENTO'
    WHEN r.status = 'EM_ABERTO' AND r.period_end IS NULL THEN 'CICLO_ABERTO_POS_VRP'
    ELSE coalesce(r.status, 'DESCONHECIDO')
  END AS fila_classificada
FROM public.vehicles v
LEFT JOIN LATERAL (
  SELECT *
  FROM public.receivables r2
  WHERE r2.vehicle_id = v.id
  ORDER BY r2.created_at DESC
  LIMIT 1
) r ON true
WHERE v.status = 'REMOVIDO'
  AND v.data_saida >= (now() - interval '60 days')
  AND (
    r.id IS NULL
    OR (r.status = 'EM_ABERTO' AND r.period_end IS NULL)
    OR (r.status = 'EM_ABERTO' AND r.period_end IS NOT NULL AND coalesce(r.financeiro_aprovado_contas_receber, false) = false)
  )
ORDER BY v.data_saida DESC;

-- 6) VRP recentes que foram direto para Contas a Receber (não Aguardando)
SELECT
  v.placa,
  v.data_saida,
  r.status,
  r.valor,
  r.financeiro_aprovado_contas_receber,
  pcc.triagem_ok,
  pcc.sent_to_finance
FROM public.vehicles v
JOIN public.receivables r ON r.vehicle_id = v.id AND r.period_end IS NOT NULL
LEFT JOIN public.patio_cycle_closures pcc ON pcc.receivable_id = r.id
WHERE v.status = 'REMOVIDO'
  AND v.data_saida >= (now() - interval '60 days')
  AND r.financeiro_aprovado_contas_receber IS TRUE
  AND r.status = 'EM_ABERTO'
ORDER BY v.data_saida DESC;
