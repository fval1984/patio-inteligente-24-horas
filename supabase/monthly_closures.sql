-- Fechamento mensal: execute no SQL Editor do Supabase (projeto do Amplipatio).
-- 1) Snapshot por mês (veículos + financeiro) e 2) mês operacional em settings.

alter table if exists settings
  add column if not exists operational_month text;

create table if not exists monthly_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year_month text not null,
  closed_at timestamptz not null default now(),
  vehicles_entered int not null default 0,
  vehicles_exited int not null default 0,
  vehicles_in_yard_end int not null default 0,
  open_receivables_value numeric not null default 0,
  open_payables_value numeric not null default 0,
  cash_balance_end numeric not null default 0,
  revenue_in_month numeric not null default 0,
  expense_in_month numeric not null default 0,
  unique (user_id, year_month)
);

create index if not exists monthly_closures_user_ym on monthly_closures (user_id, year_month desc);

alter table monthly_closures enable row level security;

drop policy if exists "monthly_closures_select_own" on monthly_closures;
drop policy if exists "monthly_closures_insert_own" on monthly_closures;
drop policy if exists "monthly_closures_delete_own" on monthly_closures;
drop policy if exists "monthly_closures_update_own" on monthly_closures;

create policy "monthly_closures_select_own" on monthly_closures
  for select using (auth.uid() = user_id);

create policy "monthly_closures_insert_own" on monthly_closures
  for insert with check (auth.uid() = user_id);

create policy "monthly_closures_delete_own" on monthly_closures
  for delete using (auth.uid() = user_id);

-- Opcional: permitir correção manual (update) pelo dono
create policy "monthly_closures_update_own" on monthly_closures
  for update using (auth.uid() = user_id);
