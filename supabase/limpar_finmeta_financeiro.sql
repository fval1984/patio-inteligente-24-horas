-- Apaga o texto visível [[finmeta:...]] e deixa só o rótulo (ex.: Zera caixa).
-- Execute no SQL Editor do Supabase (uma vez).

-- Caixa: descrição da movimentação
UPDATE cash_movements
SET descricao = trim(substring(descricao FROM position(']]' IN descricao) + 2))
WHERE descricao LIKE '[[finmeta:%'
  AND position(']]' IN descricao) > 0;

-- Contas a receber: origem / responsável
UPDATE receivables
SET responsavel_pagamento = trim(substring(responsavel_pagamento FROM position(']]' IN responsavel_pagamento) + 2))
WHERE responsavel_pagamento LIKE '[[finmeta:%'
  AND position(']]' IN responsavel_pagamento) > 0;

-- Observações (se a coluna existir)
UPDATE receivables
SET observacoes = trim(substring(observacoes FROM position(']]' IN observacoes) + 2))
WHERE observacoes LIKE '[[finmeta:%'
  AND position(']]' IN observacoes) > 0;

-- Despesas: descrição e observações
UPDATE payables
SET descricao = trim(substring(descricao FROM position(']]' IN descricao) + 2))
WHERE descricao LIKE '[[finmeta:%'
  AND position(']]' IN descricao) > 0;

UPDATE payables
SET observacoes = trim(substring(observacoes FROM position(']]' IN observacoes) + 2))
WHERE observacoes LIKE '[[finmeta:%'
  AND position(']]' IN observacoes) > 0;
