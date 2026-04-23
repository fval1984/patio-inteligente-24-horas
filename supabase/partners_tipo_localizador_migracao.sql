-- Executar no SQL Editor do Supabase (projeto correto).
-- Migra o tipo legado PARCEIRO para LOCALIZADOR.
-- Pode ser executado mais de uma vez sem problema (idempotente).

BEGIN;

UPDATE partners
SET tipo = 'LOCALIZADOR'
WHERE upper(trim(COALESCE(tipo, 'PARCEIRO'))) = 'PARCEIRO';

COMMIT;
