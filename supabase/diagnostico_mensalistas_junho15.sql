-- =============================================================================
-- Busca os 9 mensalistas informados — vencimento 15/06/2026
-- Rode no SQL Editor do Supabase (Ctrl+A → Run)
-- Conta: fernandolima@ampliauto.com.br
-- =============================================================================

-- ► RESULTADO 1 — Busca por nome (qualquer status, com ou sem vehicle_id)
WITH alvos(nome_busca) AS (
  VALUES
    ('MNC Transportes'),
    ('DANIEL ALVES'),
    ('Arnobio Alves'),
    ('JOSIEL SOBRAL'),
    ('MARCIO GUERRA'),
    ('RS Transporte'),
    ('ROBERTO MANOEL'),
    ('MCM TOUR'),
    ('NELSON TEIXEIRA')
)
SELECT
  a.nome_busca,
  r.id,
  r.created_at::date AS criado_em,
  r.updated_at::date AS atualizado_em,
  upper(r.status::text) AS status,
  r.valor,
  r.vehicle_id,
  r.subcategoria,
  r.receivable_category,
  r.period_start,
  r.period_end,
  r.financeiro_aprovado_contas_receber,
  left(coalesce(r.responsavel_pagamento, ''), 120) AS responsavel,
  left(coalesce(r.observacoes, ''), 120) AS observacoes,
  CASE
    WHEN r.vehicle_id IS NULL THEN 'manual'
    ELSE 'vinculado_veiculo'
  END AS tipo_registro
FROM alvos a
JOIN auth.users u ON lower(u.email) = lower('fernandolima@ampliauto.com.br')
LEFT JOIN public.receivables r ON r.user_id = u.id
  AND (
    coalesce(r.responsavel_pagamento, '') ILIKE '%' || a.nome_busca || '%'
    OR coalesce(r.observacoes, '') ILIKE '%' || a.nome_busca || '%'
  )
ORDER BY a.nome_busca, r.created_at DESC NULLS LAST;

-- ► RESULTADO 2 — Todos os manuais com vencimento exatamente 15/06/2026
SELECT
  r.id,
  upper(r.status::text) AS status,
  r.valor,
  r.subcategoria,
  r.period_start,
  r.period_end,
  r.financeiro_aprovado_contas_receber,
  left(coalesce(r.responsavel_pagamento, r.observacoes, ''), 150) AS cliente_texto,
  r.created_at,
  r.updated_at
FROM public.receivables r
JOIN auth.users u ON u.id = r.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
  AND r.vehicle_id IS NULL
  AND r.period_end::date = '2026-06-15'
ORDER BY r.responsavel_pagamento, r.created_at;

-- ► RESULTADO 3 — Contagem: quantos dos 9 nomes existem no banco (qualquer data)
WITH alvos(nome_busca) AS (
  VALUES
    ('MNC Transportes'),
    ('DANIEL ALVES'),
    ('Arnobio Alves'),
    ('JOSIEL SOBRAL'),
    ('MARCIO GUERRA'),
    ('RS Transporte'),
    ('ROBERTO MANOEL'),
    ('MCM TOUR'),
    ('NELSON TEIXEIRA')
)
SELECT
  a.nome_busca,
  count(r.id) AS registros_encontrados,
  count(r.id) FILTER (WHERE upper(r.status::text) = 'EM_ABERTO') AS em_aberto,
  count(r.id) FILTER (WHERE upper(r.status::text) = 'PAGO') AS pago,
  count(r.id) FILTER (WHERE upper(r.status::text) = 'AGUARDANDO_LANCAMENTO') AS aguardando,
  count(r.id) FILTER (WHERE r.period_end::date = '2026-06-15') AS venc_15jun
FROM alvos a
LEFT JOIN auth.users u ON lower(u.email) = lower('fernandolima@ampliauto.com.br')
LEFT JOIN public.receivables r ON r.user_id = u.id
  AND r.vehicle_id IS NULL
  AND (
    coalesce(r.responsavel_pagamento, '') ILIKE '%' || a.nome_busca || '%'
    OR coalesce(r.observacoes, '') ILIKE '%' || a.nome_busca || '%'
  )
GROUP BY a.nome_busca
ORDER BY a.nome_busca;

-- ► RESULTADO 4 — Se existirem mas estiverem PAGO: entrada no caixa ligada?
SELECT
  r.id,
  left(coalesce(r.responsavel_pagamento, ''), 80) AS cliente,
  upper(r.status::text) AS status_receivable,
  r.valor,
  cm.id AS caixa_id,
  cm.data_movimento,
  cm.valor AS valor_caixa,
  left(coalesce(cm.descricao, ''), 60) AS desc_caixa
FROM public.receivables r
JOIN auth.users u ON u.id = r.user_id
LEFT JOIN public.cash_movements cm ON cm.user_id = r.user_id AND cm.conta_id = r.id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
  AND r.vehicle_id IS NULL
  AND r.period_end::date = '2026-06-15'
ORDER BY r.responsavel_pagamento;

-- ► RESULTADO 5 — Nomes NÃO encontrados (deveriam ser 9 linhas com registros_encontrados = 0)
WITH alvos(nome_busca) AS (
  VALUES
    ('MNC Transportes'),
    ('DANIEL ALVES'),
    ('Arnobio Alves'),
    ('JOSIEL SOBRAL'),
    ('MARCIO GUERRA'),
    ('RS Transporte'),
    ('ROBERTO MANOEL'),
    ('MCM TOUR'),
    ('NELSON TEIXEIRA')
)
SELECT a.nome_busca AS nome_sem_registro_no_banco
FROM alvos a
LEFT JOIN auth.users u ON lower(u.email) = lower('fernandolima@ampliauto.com.br')
LEFT JOIN public.receivables r ON r.user_id = u.id
  AND r.vehicle_id IS NULL
  AND (
    coalesce(r.responsavel_pagamento, '') ILIKE '%' || a.nome_busca || '%'
    OR coalesce(r.observacoes, '') ILIKE '%' || a.nome_busca || '%'
  )
WHERE r.id IS NULL
ORDER BY a.nome_busca;
