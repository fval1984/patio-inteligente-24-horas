-- Receitas manuais (sem veículo no pátio) e despesas não usam vehicle_id.
-- Execute no SQL Editor do Supabase se aparecer:
--   null value in column "vehicle_id" of relation "receivables"

ALTER TABLE public.receivables
  ALTER COLUMN vehicle_id DROP NOT NULL;

COMMENT ON COLUMN public.receivables.vehicle_id IS
  'Veículo do pátio; NULL para receitas/despesas manuais do financeiro.';
