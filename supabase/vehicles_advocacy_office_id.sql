-- Só a coluna na tabela vehicles (idempotente).
-- Se a tabela de escritórios ainda não existir, execute também supabase/advocacy_offices.sql.
-- Supabase → SQL Editor → Run.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS advocacy_office_id uuid;

COMMENT ON COLUMN public.vehicles.advocacy_office_id IS
  'Escritório de advocacia da demanda. NULL = sem escritório informado.';

CREATE INDEX IF NOT EXISTS vehicles_advocacy_office_id_idx
  ON public.vehicles (advocacy_office_id);

CREATE INDEX IF NOT EXISTS vehicles_user_advocacy_office_idx
  ON public.vehicles (user_id, advocacy_office_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'advocacy_offices'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_advocacy_office_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_advocacy_office_id_fkey
      FOREIGN KEY (advocacy_office_id)
      REFERENCES public.advocacy_offices (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
