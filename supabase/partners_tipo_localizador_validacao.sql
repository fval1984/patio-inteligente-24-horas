-- Executar no SQL Editor do Supabase (projeto correto).
-- Conferência dos tipos na tabela partners.

-- 1) Resumo por tipo (já normalizado)
SELECT
  CASE
    WHEN tipo IS NULL OR btrim(tipo) = '' THEN 'SEM_TIPO'
    ELSE upper(btrim(tipo))
  END AS tipo_normalizado,
  COUNT(*) AS quantidade
FROM partners
GROUP BY 1
ORDER BY 2 DESC, 1 ASC;

-- 2) Registros ainda como PARCEIRO (ideal: 0 após migração)
SELECT id, user_id, nome, tipo
FROM partners
WHERE upper(trim(COALESCE(tipo, 'PARCEIRO'))) = 'PARCEIRO'
ORDER BY user_id, nome;

-- 3) Registros com tipo fora do padrão esperado
SELECT id, user_id, nome, tipo
FROM partners
WHERE upper(trim(COALESCE(tipo, ''))) NOT IN (
  'LOCALIZADOR',
  'ASSESSORIA',
  'INSTITUICAO_FINANCEIRA',
  'REMOCAO'
)
ORDER BY user_id, nome;
