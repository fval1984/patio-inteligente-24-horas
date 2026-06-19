-- =============================================================================
-- Diagnóstico: mensalistas / receitas manuais em Contas a Receber
-- Rode no SQL Editor do Supabase (Ctrl+A → Run)
-- E-mail: fernandolima@ampliauto.com.br
-- =============================================================================

-- ► RESULTADO 1 — Resumo por status (manuais = sem vehicle_id)
SELECT
  u.id AS user_id,
  u.email,
  count(*) FILTER (WHERE r.vehicle_id IS NULL) AS manuais_total,
  count(*) FILTER (WHERE r.vehicle_id IS NULL AND upper(r.status::text) = 'EM_ABERTO') AS manuais_em_aberto,
  count(*) FILTER (WHERE r.vehicle_id IS NULL AND upper(r.status::text) = 'AGUARDANDO_LANCAMENTO') AS manuais_aguardando,
  count(*) FILTER (WHERE r.vehicle_id IS NULL AND upper(r.status::text) = 'PAGO') AS manuais_pago,
  count(*) FILTER (
    WHERE r.vehicle_id IS NULL
      AND coalesce(r.financeiro_aprovado_contas_receber, false) = true
  ) AS manuais_aprovado_coluna,
  count(*) FILTER (
    WHERE r.vehicle_id IS NULL
      AND (
        coalesce(r.observacoes, '') LIKE '%[[finmeta:%'
        OR coalesce(r.responsavel_pagamento, '') LIKE '%[[finmeta:%'
      )
  ) AS manuais_com_finmeta,
  count(*) FILTER (
    WHERE r.vehicle_id IS NULL
      AND coalesce(r.observacoes, '') NOT LIKE '%[[finmeta:%'
      AND coalesce(r.responsavel_pagamento, '') NOT LIKE '%[[finmeta:%'
      AND coalesce(r.financeiro_aprovado_contas_receber, false) = false
  ) AS manuais_orfaos_sem_meta_sem_aprovado
FROM auth.users u
LEFT JOIN public.receivables r ON r.user_id = u.id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
GROUP BY u.id, u.email;

-- ► RESULTADO 2 — Últimos 30 lançamentos manuais (qualquer status)
SELECT
  r.id,
  r.created_at,
  r.updated_at,
  upper(r.status::text) AS status,
  r.valor,
  r.subcategoria,
  r.receivable_category,
  r.period_start,
  r.period_end,
  r.financeiro_aprovado_contas_receber,
  left(coalesce(r.responsavel_pagamento, ''), 80) AS responsavel_resumo,
  left(coalesce(r.observacoes, ''), 80) AS observacoes_resumo,
  CASE
    WHEN coalesce(r.observacoes, '') LIKE '%CONTROLE_RECEITAS%' THEN 'meta_obs'
    WHEN coalesce(r.responsavel_pagamento, '') LIKE '%CONTROLE_RECEITAS%' THEN 'meta_resp'
    WHEN upper(coalesce(r.subcategoria, '')) IN ('MANUAL', 'RECORRENTE') THEN 'subcategoria'
    ELSE 'sem_marcador'
  END AS origem_detectada
FROM public.receivables r
JOIN auth.users u ON u.id = r.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
  AND r.vehicle_id IS NULL
ORDER BY r.created_at DESC
LIMIT 30;

-- ► RESULTADO 3 — Manuais EM_ABERTO/AGUARDANDO que a UI antiga poderia ocultar
SELECT
  r.id,
  upper(r.status::text) AS status,
  r.valor,
  r.period_end,
  r.financeiro_aprovado_contas_receber,
  r.subcategoria,
  left(coalesce(r.responsavel_pagamento, r.observacoes, ''), 100) AS texto
FROM public.receivables r
JOIN auth.users u ON u.id = r.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
  AND r.vehicle_id IS NULL
  AND upper(r.status::text) IN ('EM_ABERTO', 'AGUARDANDO_LANCAMENTO')
  AND coalesce(r.financeiro_aprovado_contas_receber, false) = false
  AND coalesce(r.observacoes, '') NOT LIKE '%[[finmeta:%'
  AND coalesce(r.responsavel_pagamento, '') NOT LIKE '%[[finmeta:%'
ORDER BY r.created_at DESC;

-- ► RESULTADO 4 — Migração SQL destrutiva? (EM_ABERTO+period_end → AGUARDANDO)
SELECT count(*) AS afetados_pela_migracao_aguardando
FROM public.receivables r
JOIN auth.users u ON u.id = r.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
  AND r.vehicle_id IS NULL
  AND upper(r.status::text) = 'AGUARDANDO_LANCAMENTO'
  AND r.period_end IS NOT NULL;

-- ► RESULTADO 5 — Execuções de migração junho/2026
SELECT
  m.id,
  m.migration_type,
  m.status,
  m.cutoff_ymd,
  m.created_at,
  m.executed_at,
  m.summary
FROM public.finance_migration_runs m
JOIN auth.users u ON u.id = m.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
ORDER BY m.created_at DESC
LIMIT 10;
