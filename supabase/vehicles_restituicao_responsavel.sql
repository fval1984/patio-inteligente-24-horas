-- Destinação do veículo e responsável pela restituição (aditivo).
-- Não preenche registros existentes. Executar no Supabase → SQL Editor → Run.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS destinacao text;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS restituicao_responsavel_nome text;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_destinacao_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_destinacao_check
  CHECK (
    destinacao IS NULL
    OR destinacao IN ('RESTITUICAO', 'LEILAO')
  );

COMMENT ON COLUMN public.vehicles.destinacao IS
  'Destinação: RESTITUICAO ou LEILAO. Independente do status VNP/VSL/VSC/VRP.';

COMMENT ON COLUMN public.vehicles.restituicao_responsavel_nome IS
  'Nome completo de quem recebe o veículo na restituição. Só obrigatório quando destinacao = RESTITUICAO.';

NOTIFY pgrst, 'reload schema';
