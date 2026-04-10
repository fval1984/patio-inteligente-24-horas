-- Perfil do utilizador delegado: gestor de pista (completo) vs operador (cadastro + consulta sem valores).
-- Executar no SQL Editor do Supabase após já existir a tabela track_managers.

ALTER TABLE track_managers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'GESTOR_PISTA';

ALTER TABLE track_managers DROP CONSTRAINT IF EXISTS track_managers_role_check;
ALTER TABLE track_managers ADD CONSTRAINT track_managers_role_check
  CHECK (role IN ('GESTOR_PISTA', 'OPERADOR_CADASTRO'));

COMMENT ON COLUMN track_managers.role IS
  'GESTOR_PISTA: pátio sem valores, pode parceiros. OPERADOR_CADASTRO: só regista placa/modelo/localizador e consulta período, sem editar/apagar/liberar.';

-- RLS: o utilizador delegado (auth.uid() = track_managers.user_id) precisa de políticas que permitam
-- ler/inserir veículos e parceiros do dono (owner_user_id), não só onde user_id = auth.uid().
-- Sem isso o login do operador/gestor pode não ver dados do pátio. Ajuste no painel Supabase → Authentication → Policies.
