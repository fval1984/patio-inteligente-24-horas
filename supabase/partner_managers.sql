-- Gestores de carteira e de cobrança (1 parceiro → N).
-- Executar no Supabase → SQL Editor → Run (idempotente).
-- Não apaga partners, advocacy_offices nem advocacy_office_managers.
-- Escritório continua em advocacy_offices; carteira do escritório permanece em advocacy_office_managers.
-- Esta tabela cobre: carteira/cobrança de partners + cobrança (e carteira extra) de escritórios.

ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS nome_fantasia text;

ALTER TABLE public.advocacy_offices ADD COLUMN IF NOT EXISTS trade_name text;
ALTER TABLE public.advocacy_offices ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.advocacy_offices ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.advocacy_offices ADD COLUMN IF NOT EXISTS state text;

ALTER TABLE public.advocacy_office_managers ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE TABLE IF NOT EXISTS public.partner_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.partners (id) ON DELETE CASCADE,
  advocacy_office_id uuid REFERENCES public.advocacy_offices (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('CARTEIRA', 'COBRANCA')),
  name text NOT NULL,
  cpf text,
  cpf_digits text NOT NULL DEFAULT '',
  phone text,
  whatsapp text,
  email text,
  role_title text,
  notes text,
  status text NOT NULL DEFAULT 'ATIVO',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT partner_managers_one_parent CHECK (
    (partner_id IS NOT NULL AND advocacy_office_id IS NULL)
    OR (partner_id IS NULL AND advocacy_office_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.partner_managers IS
  'Gestores de carteira (setor retomados) e gestores de cobrança (financeiro). 1→N por parceiro ou escritório.';

CREATE INDEX IF NOT EXISTS partner_managers_partner_idx
  ON public.partner_managers (partner_id, kind, status, name);

CREATE INDEX IF NOT EXISTS partner_managers_office_idx
  ON public.partner_managers (advocacy_office_id, kind, status, name);

CREATE INDEX IF NOT EXISTS partner_managers_user_idx
  ON public.partner_managers (user_id, kind);

CREATE UNIQUE INDEX IF NOT EXISTS partner_managers_partner_cpf_uidx
  ON public.partner_managers (user_id, partner_id, kind, cpf_digits)
  WHERE partner_id IS NOT NULL AND cpf_digits <> '';

CREATE UNIQUE INDEX IF NOT EXISTS partner_managers_office_cpf_uidx
  ON public.partner_managers (user_id, advocacy_office_id, kind, cpf_digits)
  WHERE advocacy_office_id IS NOT NULL AND cpf_digits <> '';

ALTER TABLE public.partner_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_managers_select_own ON public.partner_managers;
CREATE POLICY partner_managers_select_own
  ON public.partner_managers
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

DROP POLICY IF EXISTS partner_managers_insert_owner ON public.partner_managers;
CREATE POLICY partner_managers_insert_owner
  ON public.partner_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (
        partner_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND p.user_id = auth.uid())
      )
      OR (
        advocacy_office_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.advocacy_offices o WHERE o.id = advocacy_office_id AND o.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS partner_managers_update_owner ON public.partner_managers;
CREATE POLICY partner_managers_update_owner
  ON public.partner_managers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS partner_managers_delete_owner ON public.partner_managers;
CREATE POLICY partner_managers_delete_owner
  ON public.partner_managers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_managers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_managers TO service_role;

NOTIFY pgrst, 'reload schema';
