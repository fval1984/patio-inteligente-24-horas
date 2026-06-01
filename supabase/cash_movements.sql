-- Movimentações do caixa (Financeiro → Caixa / Lista → Fluxo de caixa).
-- Execute no SQL Editor do Supabase se pagamentos confirmados não aparecerem no caixa.

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo_conta text not null check (tipo_conta in ('RECEBER', 'PAGAR', 'ENTRADA', 'SAIDA')),
  conta_id uuid null,
  valor numeric(14,2) not null default 0,
  descricao text null,
  data_movimento date null,
  forma_pagamento text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_movements_user_created
  on public.cash_movements(user_id, created_at desc);

create index if not exists idx_cash_movements_user_conta
  on public.cash_movements(user_id, tipo_conta, conta_id);

alter table public.cash_movements enable row level security;

drop policy if exists cash_movements_select_own on public.cash_movements;
create policy cash_movements_select_own
  on public.cash_movements for select
  using (auth.uid() = user_id);

drop policy if exists cash_movements_insert_own on public.cash_movements;
create policy cash_movements_insert_own
  on public.cash_movements for insert
  with check (auth.uid() = user_id);

drop policy if exists cash_movements_update_own on public.cash_movements;
create policy cash_movements_update_own
  on public.cash_movements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists cash_movements_delete_own on public.cash_movements;
create policy cash_movements_delete_own
  on public.cash_movements for delete
  using (auth.uid() = user_id);
