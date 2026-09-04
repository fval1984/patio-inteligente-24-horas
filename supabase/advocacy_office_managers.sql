-- Gestores de carteira vinculados ao escritório de advocacia.
-- 1 escritório → N gestores. Não é cadastro geral em Parceiros.
-- Conceito: gestores_carteira.escritorio_id = advocacy_office_managers.office_id
-- Executar no Supabase → SQL Editor → Run (idempotente). Não altera escritórios existentes.

CREATE TABLE IF NOT EXISTS public.advocacy_office_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES public.advocacy_offices (id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text,
  cpf_digits text NOT NULL DEFAULT '',
  phone text,
  email text,
  role_title text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.advocacy_office_managers IS
  'Gestores de carteira (filho do escritório). Isolados por office_id.';

COMMENT ON COLUMN public.advocacy_office_managers.office_id IS
  'escritorio_id — escritório dono do gestor. Nunca nulo.';

CREATE INDEX IF NOT EXISTS advocacy_office_managers_office_idx
  ON public.advocacy_office_managers (office_id, active, name);

CREATE INDEX IF NOT EXISTS advocacy_office_managers_user_idx
  ON public.advocacy_office_managers (user_id, office_id);

CREATE UNIQUE INDEX IF NOT EXISTS advocacy_office_managers_user_cpf_uidx
  ON public.advocacy_office_managers (user_id, cpf_digits)
  WHERE cpf_digits <> '';

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS advocacy_office_manager_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_advocacy_office_manager_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_advocacy_office_manager_id_fkey
      FOREIGN KEY (advocacy_office_manager_id)
      REFERENCES public.advocacy_office_managers (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.vehicles.advocacy_office_manager_id IS
  'Gestor de carteira da demanda. Deve pertencer ao escritório do veículo. NULL = sem gestor.';

CREATE INDEX IF NOT EXISTS vehicles_advocacy_office_manager_id_idx
  ON public.vehicles (advocacy_office_manager_id);

ALTER TABLE public.advocacy_office_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advocacy_office_managers_select_own ON public.advocacy_office_managers;
CREATE POLICY advocacy_office_managers_select_own
  ON public.advocacy_office_managers
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS advocacy_office_managers_insert_owner ON public.advocacy_office_managers;
CREATE POLICY advocacy_office_managers_insert_owner
  ON public.advocacy_office_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.advocacy_offices o
      WHERE o.id = office_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS advocacy_office_managers_update_owner ON public.advocacy_office_managers;
CREATE POLICY advocacy_office_managers_update_owner
  ON public.advocacy_office_managers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.advocacy_offices o
      WHERE o.id = office_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS advocacy_office_managers_delete_owner ON public.advocacy_office_managers;
CREATE POLICY advocacy_office_managers_delete_owner
  ON public.advocacy_office_managers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advocacy_office_managers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advocacy_office_managers TO service_role;

NOTIFY pgrst, 'reload schema';
