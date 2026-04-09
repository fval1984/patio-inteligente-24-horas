-- Aprovação «Ir para contas a receber» sincronizada entre dispositivos (mesmo utilizador Supabase).
-- Executar no SQL Editor do projeto antes de confiar apenas na app atualizada.

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS financeiro_aprovado_contas_receber boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN receivables.financeiro_aprovado_contas_receber IS
  'Quando true, o ciclo EM_ABERTO encerrado aparece em Contas a receber; quando false, em Aguardando lançamento.';
