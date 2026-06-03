-- Coluna opcional para meta [[finmeta:...]] em contas a receber.
-- A app funciona sem ela (usa responsavel_pagamento). Execute se quiser a coluna dedicada.

ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS observacoes text;

COMMENT ON COLUMN public.receivables.observacoes IS
  'Observações e meta financeira (forma de pagamento, recorrência, etc.).';
