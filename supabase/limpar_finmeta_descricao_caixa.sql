-- Remove [[finmeta:...]] da descrição das movimentações de caixa (entrada manual legada).
-- Execute no SQL Editor do Supabase.

UPDATE cash_movements
SET descricao = trim(substring(descricao FROM position(']]' IN descricao) + 2))
WHERE descricao LIKE '[[finmeta:%'
  AND position(']]' IN descricao) > 0;
