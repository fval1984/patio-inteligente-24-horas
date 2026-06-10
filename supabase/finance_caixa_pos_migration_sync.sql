-- Sincroniza flags nativas após finance_june_migration.sql + migração do caixa.
-- Substitua :USER_ID pelo uuid do usuário (auth.users.id).

-- Opcional (marco legado do reset de caixa; não está em finance_june_migration.sql)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS caixa_reset_ym text;

UPDATE public.settings
SET
  finance_manual_caixa_mode = true,
  caixa_opening_balance = 0,
  caixa_operational_reset_at = COALESCE(caixa_operational_reset_at, now()),
  caixa_reset_ym = 'MANUAL_CAIXA_V1'
WHERE user_id = ':USER_ID';

UPDATE public.cash_movements
SET
  excluir_do_saldo = true,
  aprovado_caixa = false
WHERE user_id = ':USER_ID'
  AND (excluir_do_saldo IS DISTINCT FROM true OR aprovado_caixa IS DISTINCT FROM false);

-- Validação
SELECT
  finance_manual_caixa_mode,
  caixa_opening_balance,
  caixa_reset_ym,
  caixa_operational_reset_at
FROM public.settings
WHERE user_id = ':USER_ID';

SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE excluir_do_saldo = true) AS excluidos,
  COUNT(*) FILTER (WHERE aprovado_caixa = true) AS aprovados_caixa,
  COALESCE(SUM(CASE WHEN aprovado_caixa = true AND upper(tipo_conta) IN ('RECEBER','ENTRADA') THEN valor ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN aprovado_caixa = true AND upper(tipo_conta) IN ('PAGAR','SAIDA','SAÍDA') THEN valor ELSE 0 END), 0) AS saldo_operacional
FROM public.cash_movements
WHERE user_id = ':USER_ID';
