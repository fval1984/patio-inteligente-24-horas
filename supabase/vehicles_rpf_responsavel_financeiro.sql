-- RPF (responsável financeiro / pagamento) no cadastro do veículo — distinto do RPV (localizador_id).
-- Executar no SQL Editor do projeto Supabase se o registo não gravar o RPF ou aparecer aviso de migração.
-- O mesmo bloco está no início de finance_competency_schema.sql (executar esse ficheiro também cria estas colunas).

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS responsavel_financeiro_id uuid;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS responsavel_financeiro_nome text;

COMMENT ON COLUMN vehicles.responsavel_financeiro_id IS 'Parceiro responsável financeiro / pagamento (RPF); pode coincidir com o RPV ou ser outro.';
COMMENT ON COLUMN vehicles.responsavel_financeiro_nome IS 'Nome gravado junto ao RPF (espelho do parceiro selecionado, para relatórios).';
