-- Diagnóstico: reentrada da mesma placa (ciclos independentes)
-- Substitua a placa abaixo. Rode no SQL Editor do Supabase.

-- ► RESULTADO 1 — Todos os ciclos (vehicles.id) da placa
SELECT
  v.id AS ciclo_id,
  v.placa,
  v.status,
  v.data_entrada,
  v.data_saida,
  v.created_at,
  v.responsavel_financeiro_nome,
  p.nome AS rpp_nome
FROM public.vehicles v
JOIN auth.users u ON u.id = v.user_id
LEFT JOIN public.partners p ON p.id = v.responsavel_financeiro_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
  AND upper(regexp_replace(trim(v.placa), '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(trim('RNL5E53'), '[^A-Za-z0-9]', '', 'g'))
ORDER BY v.data_entrada DESC NULLS LAST, v.created_at DESC;

-- ► RESULTADO 2 — Recebíveis por ciclo (vehicle_id)
SELECT
  v.placa,
  v.id AS ciclo_id,
  r.id AS receivable_id,
  upper(r.status::text) AS status,
  r.valor,
  r.period_start,
  r.period_end,
  r.financeiro_aprovado_contas_receber,
  r.created_at
FROM public.receivables r
JOIN public.vehicles v ON v.id = r.vehicle_id
JOIN auth.users u ON u.id = r.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
  AND upper(regexp_replace(trim(v.placa), '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(trim('RNL5E53'), '[^A-Za-z0-9]', '', 'g'))
ORDER BY v.data_entrada DESC, r.created_at DESC;

-- ► RESULTADO 3 — Fechamentos de ciclo (patio_cycle_closures)
SELECT
  v.placa,
  v.id AS ciclo_id,
  pcc.id AS closure_id,
  pcc.receivable_id,
  pcc.period_start,
  pcc.period_end,
  pcc.valor,
  pcc.sent_to_finance,
  pcc.created_at
FROM public.patio_cycle_closures pcc
JOIN public.vehicles v ON v.id = pcc.vehicle_id
JOIN auth.users u ON u.id = pcc.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
  AND upper(regexp_replace(trim(v.placa), '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(trim('RNL5E53'), '[^A-Za-z0-9]', '', 'g'))
ORDER BY pcc.created_at DESC;
