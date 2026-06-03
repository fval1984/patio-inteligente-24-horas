-- Receita manual = lançamento livre, SEM veículo/placa (vehicle_id fica NULL).
-- Execute UMA VEZ no SQL Editor do Supabase se aparecer:
--   null value in column "vehicle_id" of relation "receivables"

ALTER TABLE public.receivables
  ALTER COLUMN vehicle_id DROP NOT NULL;

COMMENT ON COLUMN public.receivables.vehicle_id IS
  'Opcional: veículo do pátio. NULL = receita manual ou título sem placa.';
