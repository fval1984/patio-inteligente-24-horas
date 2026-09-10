-- Permite apagar documentos do histórico de Cobrança.
-- Não altera receivables, baixas, veículos nem parceiros.
-- Idempotente. Executar no SQL Editor se as tabelas cobrancas já existirem.

DROP POLICY IF EXISTS cobrancas_delete_own ON public.cobrancas;
CREATE POLICY cobrancas_delete_own
  ON public.cobrancas
  FOR DELETE
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS cobranca_itens_delete_own ON public.cobranca_itens;
CREATE POLICY cobranca_itens_delete_own
  ON public.cobranca_itens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cobrancas c
      WHERE c.id = cobranca_id
        AND public.patio_data_owner_match(c.user_id)
    )
  );

GRANT SELECT, INSERT, DELETE ON public.cobrancas TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.cobranca_itens TO authenticated;

NOTIFY pgrst, 'reload schema';
