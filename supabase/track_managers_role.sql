-- Coluna role para track_managers (sempre GESTOR_PISTA na app atual).
-- Se a tabela ainda não existir, usa antes (ou só) track_managers_setup_uma_vez.sql.
-- Caso contrário: executar no SQL Editor do Supabase após já existir a tabela track_managers.

ALTER TABLE track_managers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'GESTOR_PISTA';

-- Unificar linhas antigas (executar no mesmo script ou só o ficheiro track_managers_normalizar_role.sql)
UPDATE track_managers SET role = 'GESTOR_PISTA' WHERE role = 'OPERADOR_CADASTRO';

ALTER TABLE track_managers DROP CONSTRAINT IF EXISTS track_managers_role_check;
ALTER TABLE track_managers ADD CONSTRAINT track_managers_role_check
  CHECK (role IN ('GESTOR_PISTA', 'OPERADOR_CADASTRO', 'VISTORIADOR'));

COMMENT ON COLUMN track_managers.role IS
  'GESTOR_PISTA = cadastro leve e consulta do pátio. VISTORIADOR = terminal exclusivo de vistoria. OPERADOR_CADASTRO mantido só por compatibilidade com a base.';

-- RLS: o utilizador delegado (auth.uid() = track_managers.user_id) precisa de políticas que permitam
-- ler/inserir veículos e parceiros do dono (owner_user_id), não só onde user_id = auth.uid().
-- Sem isso o login do operador/gestor pode não ver dados do pátio. Ajuste no painel Supabase → Authentication → Policies.
-- Para associar gestores a partir da app sem API, ver também track_managers_rls_policies.sql.
