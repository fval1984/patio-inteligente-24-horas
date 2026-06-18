-- Dados criados em 17/06/2026 que podem manter comportamento "de hoje" (SOMENTE LEITURA)
-- E-mail: fernandolima@ampliauto.com.br

DROP TABLE IF EXISTS _diag_user;
CREATE TEMP TABLE _diag_user AS
SELECT id AS user_id FROM auth.users
WHERE lower(email) = lower('fernandolima@ampliauto.com.br') LIMIT 1;

-- Resumo: houve linhas novas no banco hoje?
SELECT
  (SELECT count(*) FROM public.receivables r JOIN _diag_user d ON d.user_id = r.user_id
   WHERE r.created_at::date = '2026-06-17') AS receivables_novos_17jun,
  (SELECT count(*) FROM public.payables p JOIN _diag_user d ON d.user_id = p.user_id
   WHERE p.created_at::date = '2026-06-17') AS payables_novos_17jun,
  (SELECT count(*) FROM public.cash_movements cm JOIN _diag_user d ON d.user_id = cm.user_id
   WHERE cm.created_at::date = '2026-06-17') AS caixa_novos_17jun;

-- Settings atuais (modo caixa — já existia em 16/06)
SELECT finance_manual_caixa_mode, caixa_reset_ym, caixa_operational_reset_at, caixa_opening_balance
FROM public.settings s JOIN _diag_user d ON d.user_id = s.user_id;

-- Últimas 20 movimentações de caixa (qualquer data)
SELECT cm.id, upper(cm.tipo_conta::text) AS tipo, cm.valor, cm.created_at::date AS criado
FROM public.cash_movements cm JOIN _diag_user d ON d.user_id = cm.user_id
ORDER BY cm.created_at DESC LIMIT 20;
