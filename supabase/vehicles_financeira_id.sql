-- Financeira do veículo (parceiro tipo instituição financeira).
-- Executar no Supabase → SQL Editor → Run (idempotente). Não apaga dados.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS financeira_id uuid;

COMMENT ON COLUMN public.vehicles.financeira_id IS
  'Parceiro tipo instituição financeira (partners.id) a que o veículo pertence.';

CREATE INDEX IF NOT EXISTS vehicles_financeira_id_idx
  ON public.vehicles (financeira_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_financeira_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_financeira_id_fkey
      FOREIGN KEY (financeira_id)
      REFERENCES public.partners (id)
      ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
