-- Liberação do ciclo para o módulo Financeiro (pré-lançamento) após triagem na aba «Fechando ciclo» do pátio.
-- Executar no SQL Editor do projeto Supabase.

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS patio_liberado_financeiro boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN receivables.patio_liberado_financeiro IS
  'Quando false: ciclo encerrado permanece só no pátio (Fechando ciclo); após OK na triagem, passa a true e entra na fila de pré-lançamento.';
