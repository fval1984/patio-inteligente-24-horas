-- Controle simples de acesso — uso exclusivo da empresa
-- Executar no Supabase → SQL Editor → Run (idempotente).
--
-- Como funciona:
--   • Utilizadores existentes → ATIVO (não são bloqueados)
--   • Novos cadastros → AGUARDANDO_AUTORIZACAO (precisam do código da empresa)
--   • O código fica só no servidor: variável AMPLIAUTO_ACCESS_CODE na Vercel

CREATE TABLE IF NOT EXISTS public.user_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  authorization_status text NOT NULL DEFAULT 'AGUARDANDO_AUTORIZACAO'
    CHECK (authorization_status IN ('AGUARDANDO_AUTORIZACAO', 'ATIVO', 'BLOQUEADO')),
  authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.user_accounts IS
  'Quem já passou pelo código de acesso da empresa (AMPLIAUTO_ACCESS_CODE no servidor).';

CREATE INDEX IF NOT EXISTS user_accounts_status_idx ON public.user_accounts (authorization_status);

-- Helper para RLS opcional
CREATE OR REPLACE FUNCTION public.user_is_authorized(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_accounts ua
    WHERE ua.user_id = check_uid AND ua.authorization_status = 'ATIVO'
  )
  OR EXISTS (
    SELECT 1 FROM public.track_managers tm
    JOIN public.user_accounts ua ON ua.user_id = tm.owner_user_id
    WHERE tm.user_id = check_uid AND ua.authorization_status = 'ATIVO'
  );
$$;

-- Migrar utilizadores que já existem → ATIVO
INSERT INTO public.user_accounts (user_id, authorization_status, authorized_at)
SELECT u.id, 'ATIVO', timezone('utc', now())
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_accounts ua WHERE ua.user_id = u.id
);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_accounts_select_own ON public.user_accounts;
CREATE POLICY user_accounts_select_own
  ON public.user_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
