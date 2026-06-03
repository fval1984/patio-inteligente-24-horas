-- LANÇAMENTO ÚNICO: despesas já marcadas como PAGO → saída no caixa.
-- Não precisa clicar em «Sincronizar caixa». Execute UMA VEZ no SQL Editor do Supabase.
-- (Requer supabase/cash_movements.sql já aplicado.)

INSERT INTO public.cash_movements (user_id, tipo_conta, conta_id, valor, descricao, data_movimento)
SELECT
  p.user_id,
  'PAGAR',
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
-- SELECT COUNT(*) FROM cash_movements WHERE tipo_conta::text IN ('PAGAR','SAIDA');
