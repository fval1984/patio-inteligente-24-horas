-- Escritórios de advocacia e vínculo com a demanda (veículo).
-- Executar no Supabase → SQL Editor → Run (idempotente).
--
-- A demanda do pátio é a tabela public.vehicles.
-- Esta migração SÓ ACRESCENTA: tabela de escritórios, coluna nullable em vehicles
-- e histórico de alteração do vínculo. Não apaga nem altera dados existentes.
-- Veículos sem escritório continuam válidos (advocacy_office_id NULL).

CREATE OR REPLACE FUNCTION public.patio_data_owner_match(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_owner IS NOT NULL AND (
    auth.uid() = p_owner
    OR EXISTS (
      SELECT 1
      FROM public.track_managers tm
      WHERE tm.user_id = auth.uid()
        AND tm.owner_user_id = p_owner
    )
  );
$$;

COMMENT ON FUNCTION public.patio_data_owner_match(uuid) IS
  'Dono do pátio ou gestor/vistoriador delegado (track_managers).';

CREATE TABLE IF NOT EXISTS public.advocacy_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  cnpj text,
  cnpj_digits text NOT NULL DEFAULT '',
  responsible_name text,
  phone text,
  whatsapp text,
  email text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.advocacy_offices IS
  'Cadastro de escritórios de advocacia (origem jurídica da demanda).';

CREATE UNIQUE INDEX IF NOT EXISTS advocacy_offices_user_cnpj_uidx
  ON public.advocacy_offices (user_id, cnpj_digits)
  WHERE cnpj_digits <> '';

CREATE INDEX IF NOT EXISTS advocacy_offices_user_active_idx
  ON public.advocacy_offices (user_id, active, name);

CREATE INDEX IF NOT EXISTS advocacy_offices_user_name_idx
  ON public.advocacy_offices (user_id, name);

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS advocacy_office_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_advocacy_office_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_advocacy_office_id_fkey
      FOREIGN KEY (advocacy_office_id)
      REFERENCES public.advocacy_offices (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON COLUMN public.vehicles.advocacy_office_id IS
  'Escritório de advocacia da demanda. NULL = sem escritório informado.';

CREATE INDEX IF NOT EXISTS vehicles_advocacy_office_id_idx
  ON public.vehicles (advocacy_office_id);

CREATE INDEX IF NOT EXISTS vehicles_user_advocacy_office_idx
  ON public.vehicles (user_id, advocacy_office_id);

CREATE TABLE IF NOT EXISTS public.advocacy_office_link_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL,
  previous_office_id uuid,
  previous_office_name text,
  new_office_id uuid,
  new_office_name text,
  changed_by_user_id uuid,
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.advocacy_office_link_history IS
  'Auditoria da alteração do escritório vinculado ao veículo/demanda.';

CREATE INDEX IF NOT EXISTS advocacy_office_link_history_vehicle_idx
  ON public.advocacy_office_link_history (vehicle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS advocacy_office_link_history_user_idx
  ON public.advocacy_office_link_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS advocacy_office_link_history_office_idx
  ON public.advocacy_office_link_history (new_office_id, created_at DESC);

ALTER TABLE public.advocacy_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocacy_office_link_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advocacy_offices_select_own ON public.advocacy_offices;
CREATE POLICY advocacy_offices_select_own
  ON public.advocacy_offices
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS advocacy_offices_insert_owner ON public.advocacy_offices;
CREATE POLICY advocacy_offices_insert_owner
  ON public.advocacy_offices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS advocacy_offices_update_owner ON public.advocacy_offices;
CREATE POLICY advocacy_offices_update_owner
  ON public.advocacy_offices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS advocacy_offices_delete_owner ON public.advocacy_offices;
CREATE POLICY advocacy_offices_delete_owner
  ON public.advocacy_offices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS advocacy_office_link_history_select_own ON public.advocacy_office_link_history;
CREATE POLICY advocacy_office_link_history_select_own
  ON public.advocacy_office_link_history
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS advocacy_office_link_history_insert_own ON public.advocacy_office_link_history;
CREATE POLICY advocacy_office_link_history_insert_own
  ON public.advocacy_office_link_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.patio_data_owner_match(user_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advocacy_offices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advocacy_offices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advocacy_office_link_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advocacy_office_link_history TO service_role;

NOTIFY pgrst, 'reload schema';
