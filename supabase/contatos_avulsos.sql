-- Contatos avulsos das movimentações (VSL, VSC, RPP e remoção).
-- Não altera parceiros, financeiro, fichas, QR Code nem registros já gravados.
-- O catálogo só sugere nome e telefone. O histórico fica na tabela de movimentação,
-- com a cópia do que foi informado na hora.
-- Executar no Supabase → SQL Editor → Run.

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

CREATE TABLE IF NOT EXISTS public.contatos_avulsos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  telefone text NOT NULL,
  telefone_norm text NOT NULL,
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ultimo_uso_em timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT contatos_avulsos_nome_ok CHECK (char_length(trim(nome)) >= 2),
  CONSTRAINT contatos_avulsos_tel_ok CHECK (char_length(telefone_norm) BETWEEN 10 AND 11)
);

COMMENT ON TABLE public.contatos_avulsos IS
  'Catálogo de contatos avulsos para sugestão. Não é cadastro de parceiro. Editar aqui não altera o histórico.';

CREATE UNIQUE INDEX IF NOT EXISTS contatos_avulsos_user_tel_uidx
  ON public.contatos_avulsos (user_id, telefone_norm);

CREATE INDEX IF NOT EXISTS contatos_avulsos_user_uso_idx
  ON public.contatos_avulsos (user_id, ultimo_uso_em DESC);

CREATE TABLE IF NOT EXISTS public.vehicle_movimento_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  event_id uuid,
  etapa text NOT NULL,
  papel text NOT NULL,
  contato_tipo text NOT NULL,
  nome text NOT NULL,
  telefone text,
  telefone_norm text,
  cadastro_id uuid,
  contato_avulso_id uuid,
  registrado_por text,
  registrado_em timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vehicle_movimento_contatos_tipo_ok CHECK (contato_tipo IN ('CADASTRADO', 'AVULSO')),
  CONSTRAINT vehicle_movimento_contatos_etapa_ok CHECK (etapa IN ('VSL', 'VSC', 'RPP', 'REMOCAO')),
  CONSTRAINT vehicle_movimento_contatos_papel_ok CHECK (
    papel IN ('solicitante', 'confirmador', 'responsavelFinanceiro', 'removeu')
  ),
  CONSTRAINT vehicle_movimento_contatos_nome_ok CHECK (char_length(trim(nome)) >= 1),
  CONSTRAINT vehicle_movimento_contatos_avulso_tel_ok CHECK (
    contato_tipo <> 'AVULSO' OR char_length(COALESCE(telefone_norm, '')) BETWEEN 10 AND 11
  )
);

COMMENT ON TABLE public.vehicle_movimento_contatos IS
  'Cópia do contato no momento da movimentação. Não é atualizada quando o catálogo avulso muda.';

CREATE INDEX IF NOT EXISTS vehicle_movimento_contatos_vehicle_idx
  ON public.vehicle_movimento_contatos (vehicle_id, registrado_em);

CREATE INDEX IF NOT EXISTS vehicle_movimento_contatos_event_idx
  ON public.vehicle_movimento_contatos (event_id);

ALTER TABLE public.contatos_avulsos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_movimento_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contatos_avulsos_select_own ON public.contatos_avulsos;
CREATE POLICY contatos_avulsos_select_own
  ON public.contatos_avulsos
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS contatos_avulsos_insert_own ON public.contatos_avulsos;
CREATE POLICY contatos_avulsos_insert_own
  ON public.contatos_avulsos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS contatos_avulsos_update_own ON public.contatos_avulsos;
CREATE POLICY contatos_avulsos_update_own
  ON public.contatos_avulsos
  FOR UPDATE
  TO authenticated
  USING (public.patio_data_owner_match(user_id))
  WITH CHECK (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS vehicle_movimento_contatos_select_own ON public.vehicle_movimento_contatos;
CREATE POLICY vehicle_movimento_contatos_select_own
  ON public.vehicle_movimento_contatos
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS vehicle_movimento_contatos_insert_own ON public.vehicle_movimento_contatos;
CREATE POLICY vehicle_movimento_contatos_insert_own
  ON public.vehicle_movimento_contatos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.patio_data_owner_match(user_id));

REVOKE ALL ON public.contatos_avulsos FROM PUBLIC, anon;
REVOKE ALL ON public.vehicle_movimento_contatos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.contatos_avulsos TO authenticated;
GRANT SELECT, INSERT ON public.vehicle_movimento_contatos TO authenticated;

NOTIFY pgrst, 'reload schema';
