-- Evolução operacional: VNP → VSL → VSC → VRP
-- Idempotente. NÃO altera, apaga nem recalcula registros existentes.
-- As etapas reutilizam os status já usados:
--   VSL = LIBERACAO_SOLICITADA
--   VSC = LIBERACAO_CONFIRMADA
-- A diária continua a contar enquanto data_saida for nula (só o VRP a preenche).
-- Executar no Supabase → SQL Editor → Run.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS liberacao_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberacao_solicitada_por text,
  ADD COLUMN IF NOT EXISTS liberacao_solicitada_obs text,
  ADD COLUMN IF NOT EXISTS liberacao_confirmada_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberacao_confirmada_por text,
  ADD COLUMN IF NOT EXISTS liberacao_confirmada_obs text;

COMMENT ON COLUMN public.vehicles.liberacao_solicitada_em IS
  'VSL: instante em que a solicitação de liberação foi registada. Não encerra diárias.';
COMMENT ON COLUMN public.vehicles.liberacao_solicitada_por IS
  'VSL: utilizador do sistema que registou a solicitação.';
COMMENT ON COLUMN public.vehicles.liberacao_solicitada_obs IS
  'VSL: observação da solicitação de liberação.';
COMMENT ON COLUMN public.vehicles.liberacao_confirmada_em IS
  'VSC: instante da confirmação/autorização de saída. Não encerra diárias.';
COMMENT ON COLUMN public.vehicles.liberacao_confirmada_por IS
  'VSC: utilizador do sistema que confirmou a liberação.';
COMMENT ON COLUMN public.vehicles.liberacao_confirmada_obs IS
  'VSC: observação da confirmação de liberação.';

NOTIFY pgrst, 'reload schema';
