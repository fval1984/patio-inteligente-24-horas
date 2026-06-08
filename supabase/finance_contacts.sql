-- Cadastros financeiros: prestadores, fornecedores e clientes (recorrentes).
-- Execute no SQL Editor do Supabase.

create table if not exists public.finance_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tipo text not null check (tipo in ('PRESTADOR', 'FORNECEDOR', 'CLIENTE')),
  nome text not null,
  documento text,
  email text,
  telefone text,
  contato text,
  observacoes text,
  recorrente_ativo boolean not null default false,
  recorrencia text not null default 'mensal'
    check (recorrencia in ('semanal', 'quinzenal', 'mensal', 'anual')),
  valor_padrao numeric(14, 2) check (valor_padrao is null or valor_padrao >= 0),
  dia_vencimento smallint not null default 5 check (dia_vencimento between 1 and 28),
  payable_category text,
  receivable_category text,
  descricao_padrao text,
  forma_pagamento text default 'PIX',
  conta_bancaria text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_contacts_user_tipo
  on public.finance_contacts (user_id, tipo, ativo, created_at desc);

create unique index if not exists ux_finance_contacts_user_tipo_nome
  on public.finance_contacts (user_id, tipo, lower(trim(nome)));

comment on table public.finance_contacts is
  'Prestadores, fornecedores e clientes do módulo financeiro, com vínculo a lançamentos recorrentes.';
