-- Revisão ADM de cadastros feitos pelo Gestor de Pista (colunas aditivas; registros existentes permanecem inalterados).
-- Executar uma vez no SQL Editor do Supabase.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS pending_adm_review boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registered_by_gestor boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS adm_reviewed_at timestamptz;

COMMENT ON COLUMN vehicles.pending_adm_review IS 'True quando o cadastro foi feito pelo gestor de pista e ainda aguarda revisão/validação do ADM.';
COMMENT ON COLUMN vehicles.registered_by_gestor IS 'True quando o veículo foi cadastrado por um gestor de pista delegado.';
COMMENT ON COLUMN vehicles.adm_reviewed_at IS 'Momento em que o ADM validou o cadastro do gestor de pista.';
