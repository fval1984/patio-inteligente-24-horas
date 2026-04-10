-- Coluna role para track_managers (sempre GESTOR_PISTA na app atual).
-- Executar no SQL Editor do Supabase após já existir a tabela track_managers.

ALTER TABLE track_managers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'GESTOR_PISTA';

-- Opcional: unificar linhas antigas se existir OPERADOR_CADASTRO
-- UPDATE track_managers SET role = 'GESTOR_PISTA' WHERE role = 'OPERADOR_CADASTRO';

ALTER TABLE track_managers DROP CONSTRAINT IF EXISTS track_managers_role_check;
ALTER TABLE track_managers ADD CONSTRAINT track_managers_role_check
  CHECK (role IN ('GESTOR_PISTA', 'OPERADOR_CADASTRO'));

COMMENT ON COLUMN track_managers.role IS
  'Na app: gestor de pista = cadastro leve (placa, modelo, localizador) e consulta sem valores; sem editar/apagar/liberar. Valor OPERADOR_CADASTRO mantido só por compatibilidade com a base.';

-- RLS: o utilizador delegado (auth.uid() = track_managers.user_id) precisa de políticas que permitam
-- ler/inserir veículos e parceiros do dono (owner_user_id), não só onde user_id = auth.uid().
-- Sem isso o login do operador/gestor pode não ver dados do pátio. Ajuste no painel Supabase → Authentication → Policies.
