-- Executar no SQL Editor do Supabase (projeto correto).
-- Impede duplicidade na base de dados.
--
-- Se o CREATE INDEX falhar com ERRO 23505 em «partners»:
--   1) Execute primeiro: supabase/cadastro_sem_duplicidade_dedupe_parceiros.sql
--   2) Volte a executar este ficheiro.

-- Veículos: mesma placa normalizada não pode repetir para o mesmo utilizador
-- enquanto o veículo ainda estiver no pátio (sem data de saída e não REMOVIDO).
-- Após saída (VRP) ou com data_saida preenchida, a placa libera para novo cadastro (reentrada).
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_user_placa_norm_nao_removido_uidx
ON vehicles (
  user_id,
  upper(regexp_replace(trim(COALESCE(placa, '')), '[^A-Za-z0-9]', '', 'g'))
)
WHERE status IS DISTINCT FROM 'REMOVIDO'
  AND data_saida IS NULL
  AND length(regexp_replace(trim(COALESCE(placa, '')), '[^A-Za-z0-9]', '', 'g')) > 0;

-- Parceiros/assessorias: mesmo nome (normalizado) por utilizador e tipo.
CREATE UNIQUE INDEX IF NOT EXISTS partners_user_tipo_nome_norm_uidx
ON partners (
  user_id,
  CAST(COALESCE(tipo, 'PARCEIRO') AS text),
  lower(regexp_replace(btrim(COALESCE(nome, '')), '[[:space:]]+', ' ', 'g'))
)
WHERE length(btrim(COALESCE(nome, ''))) > 0;

-- Parceiros: mesmo documento (CPF/CNPJ, só dígitos, 11 ou mais caracteres) por utilizador.
CREATE UNIQUE INDEX IF NOT EXISTS partners_user_doc_digits_uidx
ON partners (user_id, regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g'))
WHERE length(regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g')) >= 11;
