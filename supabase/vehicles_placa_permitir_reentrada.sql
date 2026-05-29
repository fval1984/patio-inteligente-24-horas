-- Permite cadastrar novamente a mesma placa após saída do pátio (reentrada do veículo).
-- Execute no SQL Editor do Supabase se o cadastro duplicado falhar mesmo após VRP/saída.

DROP INDEX IF EXISTS vehicles_user_placa_norm_nao_removido_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_user_placa_norm_nao_removido_uidx
ON vehicles (
  user_id,
  upper(regexp_replace(trim(COALESCE(placa, '')), '[^A-Za-z0-9]', '', 'g'))
)
WHERE status IS DISTINCT FROM 'REMOVIDO'
  AND data_saida IS NULL
  AND length(regexp_replace(trim(COALESCE(placa, '')), '[^A-Za-z0-9]', '', 'g')) > 0;
