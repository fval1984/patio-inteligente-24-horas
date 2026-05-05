-- Indica se a nota fiscal já foi enviada ao cliente (triagem do pátio).
-- Executar no SQL Editor do projeto Supabase.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS nfse_enviada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN vehicles.nfse_enviada IS 'Nota fiscal já enviada (conferência na aba Fechando ciclo).';
