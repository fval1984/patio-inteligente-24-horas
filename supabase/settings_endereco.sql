-- Campos opcionais para recibo e rodapé (Configurações).
alter table if exists settings add column if not exists endereco text;
alter table if exists settings add column if not exists recibo_emitente_nome text;
alter table if exists settings add column if not exists recibo_telefone text;
