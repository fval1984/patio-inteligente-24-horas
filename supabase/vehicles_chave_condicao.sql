-- Condição da chave no registro do veículo (aditivo).
-- NULL = veículos antigos sem informação. Não preenche registros existentes.
-- Executar no Supabase → SQL Editor → Run.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS chave_condicao text;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_chave_condicao_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_chave_condicao_check
  CHECK (
    chave_condicao IS NULL
    OR chave_condicao IN ('C_CHAVE', 'S_CHAVE', 'TRANCADO')
  );

COMMENT ON COLUMN public.vehicles.chave_condicao IS
  'Condição da chave: C_CHAVE (C/CHAVE), S_CHAVE (S/CHAVE), TRANCADO. Independente do status operacional.';

NOTIFY pgrst, 'reload schema';
