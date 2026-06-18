-- =============================================================================
-- Diagnóstico Supabase — rode TUDO de uma vez (Ctrl+A → Run)
-- DROP/CREATE não mostram tabela (só "Success") — isso é NORMAL.
-- As tabelas aparecem nos SELECTs abaixo (abas Result 1, 2, 3…)
-- E-mail: fernandolima@ampliauto.com.br
-- =============================================================================

-- ► RESULTADO 1 — Resumo (sempre 1 linha)
SELECT
  u.id AS user_id,
  u.email,
  (SELECT count(*) FROM public.receivables r
   WHERE r.user_id = u.id AND r.created_at::date = '2026-06-17') AS receivables_novos_17jun,
  (SELECT count(*) FROM public.payables p
   WHERE p.user_id = u.id AND p.created_at::date = '2026-06-17') AS payables_novos_17jun,
  (SELECT count(*) FROM public.cash_movements cm
   WHERE cm.user_id = u.id AND cm.created_at::date = '2026-06-17') AS caixa_novos_17jun,
  (SELECT count(*) FROM public.receivables r WHERE r.user_id = u.id) AS total_receivables,
  (SELECT count(*) FROM public.payables p WHERE p.user_id = u.id) AS total_payables,
  (SELECT count(*) FROM public.cash_movements cm WHERE cm.user_id = u.id) AS total_caixa
FROM auth.users u
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
LIMIT 1;

-- ► RESULTADO 2 — Settings do caixa
SELECT
  s.finance_manual_caixa_mode,
  s.caixa_reset_ym,
  s.caixa_operational_reset_at,
  s.caixa_opening_balance
FROM public.settings s
JOIN auth.users u ON u.id = s.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br');

-- ► RESULTADO 3 — Últimas 20 movimentações de caixa
SELECT
  cm.id,
  upper(cm.tipo_conta::text) AS tipo,
  cm.valor,
  cm.created_at::date AS criado_em,
  left(coalesce(cm.descricao, ''), 60) AS descricao_resumo
FROM public.cash_movements cm
JOIN auth.users u ON u.id = cm.user_id
WHERE lower(u.email) = lower('fernandolima@ampliauto.com.br')
ORDER BY cm.created_at DESC
LIMIT 20;
