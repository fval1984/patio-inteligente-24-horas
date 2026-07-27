-- Cadastro inteligente de parceiros (tabela única).
-- Executar no SQL Editor do Supabase (projeto correto).
-- Não cria tabelas separadas — apenas colunas na tabela partners.

ALTER TABLE partners ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS status text DEFAULT 'ATIVO';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS observacoes text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS perfil jsonb DEFAULT '{}'::jsonb;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS contatos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS documentos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS historico jsonb DEFAULT '[]'::jsonb;

-- Normaliza tipos legados
UPDATE partners
SET tipo = 'LOCALIZADOR'
WHERE upper(trim(COALESCE(tipo, ''))) IN ('PARCEIRO', '');

UPDATE partners
SET tipo = 'GUINCHEIRO'
WHERE upper(trim(COALESCE(tipo, ''))) = 'REMOCAO';

UPDATE partners
SET status = 'ATIVO'
WHERE status IS NULL OR btrim(status) = '';

-- Bucket de anexos (opcional). Crie no Storage se ainda não existir:
-- partner-attachments (público ou privado conforme política da empresa).
