-- Diagnóstico: despesas PAGO sem saída no caixa (rode no SQL Editor).

SELECT
  p.id,
  p.descricao,
  p.valor,
  p.status::text AS status,
  p.data_vencimento,
  EXISTS (
    SELECT 1 FROM public.cash_movements cm
    WHERE cm.conta_id = p.id
      AND cm.user_id = p.user_id
      AND cm.tipo_conta::text IN ('PAGAR', 'SAIDA')
  ) AS ja_no_caixa
FROM public.payables p
WHERE p.status::text = 'PAGO'
  AND coalesce(p.valor, 0) > 0
ORDER BY p.data_vencimento DESC NULLS LAST;
