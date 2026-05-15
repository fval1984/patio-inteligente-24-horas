-- Executar uma vez no SQL Editor do Supabase (projeto correto).
-- Habilita o laudo de vistoria no cadastro/ficha do veículo.
-- Para vistoria + leiloeiro + RPF juntos: vehicles_recursos_avancados.sql ou início de finance_competency_schema.sql.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vistoria_data timestamptz;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vistoria_responsavel text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vistoria_km text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vistoria_combustivel text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vistoria_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vistoria_observacoes text;

COMMENT ON COLUMN vehicles.vistoria_data IS 'Data/hora da vistoria realizada no cadastro do veículo.';
COMMENT ON COLUMN vehicles.vistoria_responsavel IS 'Nome do responsável pela vistoria.';
COMMENT ON COLUMN vehicles.vistoria_km IS 'Quilometragem registrada no momento da vistoria.';
COMMENT ON COLUMN vehicles.vistoria_combustivel IS 'Nível de combustível informado na vistoria.';
COMMENT ON COLUMN vehicles.vistoria_checklist IS 'Checklist da vistoria (documento/chave/estepe/triângulo-macaco).';
COMMENT ON COLUMN vehicles.vistoria_observacoes IS 'Avarias e observações da vistoria.';

-- RPF (responsável financeiro / pagamento) — necessário para gravar o campo no cadastro de entrada
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS responsavel_financeiro_id uuid;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS responsavel_financeiro_nome text;
COMMENT ON COLUMN vehicles.responsavel_financeiro_id IS 'Parceiro RPF (pagamento); pode coincidir com o RPV ou ser outro.';
COMMENT ON COLUMN vehicles.responsavel_financeiro_nome IS 'Nome gravado com o RPF (espelho do parceiro selecionado).';
