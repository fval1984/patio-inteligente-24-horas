-- Forma de pagamento em contas a receber (opcional; a app também grava em observacoes [[finmeta:...]]).
-- Executar no SQL Editor do Supabase se quiser a coluna dedicada.

ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

COMMENT ON COLUMN public.receivables.forma_pagamento IS
  'PIX, DINHEIRO, etc. Espelho opcional do meta em observacoes.';
