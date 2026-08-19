-- Setup completo: criar tabela track_managers + coluna role + RLS.
-- Cola no Supabase → SQL Editor → Run (seguro repetir: IF NOT EXISTS / DROP POLICY IF EXISTS).

-- === Parte 0: tabela (se ainda não existir) ===
CREATE TABLE IF NOT EXISTS public.track_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'GESTOR_PISTA',
  created_at timestamptz NOT NULL DEFAULT (timezone('utc', now())),
  CONSTRAINT track_managers_owner_delegate_unique UNIQUE (owner_user_id, user_id),
  CONSTRAINT track_managers_role_check CHECK (role IN ('GESTOR_PISTA', 'OPERADOR_CADASTRO', 'VISTORIADOR'))
);

COMMENT ON TABLE public.track_managers IS
  'Ligação entre o dono do pátio (owner_user_id) e um utilizador Auth delegado (user_id) com perfil gestor de pista.';

-- === Parte 1: migração se a tabela já existia sem coluna role ===
ALTER TABLE public.track_managers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'GESTOR_PISTA';

UPDATE public.track_managers SET role = 'GESTOR_PISTA' WHERE role = 'OPERADOR_CADASTRO';

ALTER TABLE public.track_managers DROP CONSTRAINT IF EXISTS track_managers_role_check;
ALTER TABLE public.track_managers ADD CONSTRAINT track_managers_role_check
  CHECK (role IN ('GESTOR_PISTA', 'OPERADOR_CADASTRO', 'VISTORIADOR'));

COMMENT ON COLUMN public.track_managers.role IS
  'GESTOR_PISTA = cadastro leve e consulta do pátio. VISTORIADOR = terminal exclusivo de vistoria. OPERADOR_CADASTRO mantido só por compatibilidade.';

-- === Parte 2: RLS ===
ALTER TABLE public.track_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS track_managers_select_owner_or_delegate ON public.track_managers;
DROP POLICY IF EXISTS track_managers_insert_owner ON public.track_managers;
DROP POLICY IF EXISTS track_managers_update_owner ON public.track_managers;
DROP POLICY IF EXISTS track_managers_delete_owner ON public.track_managers;

CREATE POLICY track_managers_select_owner_or_delegate
  ON public.track_managers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = user_id);

CREATE POLICY track_managers_insert_owner
  ON public.track_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY track_managers_update_owner
  ON public.track_managers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY track_managers_delete_owner
  ON public.track_managers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_user_id);
