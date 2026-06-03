-- LANÇAMENTO ÚNICO: despesas já PAGO → saída no caixa (sem «Sincronizar caixa»).
-- Execute no SQL Editor do Supabase. Requer cash_movements.sql aplicado.

INSERT INTO public.cash_movements (user_id, tipo_conta, conta_id, valor, descricao, data_movimento)
SELECT
  p.user_id,
  COALESCE(
    (
      SELECT e.enumlabel::public.account_type
      FROM pg_enum e
      INNER JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'account_type'
        AND e.enumlabel IN ('PAGAR', 'SAIDA')
      ORDER BY CASE e.enumlabel WHEN 'PAGAR' THEN 0 ELSE 1 END
      LIMIT 1
    ),
    'SAIDA'::public.account_type
  ),
  p.id,
  ROUND(p.valor::numeric, 2),
  COALESCE(NULLIF(TRIM(p.descricao), ''), 'Despesa'),
  COALESCE(p.data_vencimento::date, (p.updated_at AT TIME ZONE 'America/Sao_Paulo')::date, CURRENT_DATE)
FROM public.payables p
WHERE p.status::text = 'PAGO'
  AND coalesce(p.valor, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.cash_movements cm
    WHERE cm.user_id = p.user_id
      AND cm.conta_id = p.id
      AND cm.tipo_conta::text IN ('PAGAR', 'SAIDA')
  );

-- Conferir (opcional):
-- SELECT p.descricao, p.valor, cm.id, cm.tipo_conta::text
-- FROM payables p
-- LEFT JOIN cash_movements cm ON cm.conta_id = p.id AND cm.user_id = p.user_id
-- WHERE p.status::text = 'PAGO'
-- ORDER BY p.data_vencimento DESC NULLS LAST;
