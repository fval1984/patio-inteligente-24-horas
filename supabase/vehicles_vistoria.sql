-- Executar uma vez no SQL Editor do Supabase (projeto correto).
-- Habilita o laudo de vistoria no cadastro/ficha do veículo.

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
