-- Regime de competência para financeiro/contábil.
-- Não remove histórico: usa status, timestamps e referências de origem.

-- Pré-requisito no cadastro de veículos: RPF (responsável financeiro), usado pelo app ao gravar.
-- Idempotente (IF NOT EXISTS). Também existe supabase/vehicles_rpf_responsavel_financeiro.sql isolado.
alter table public.vehicles add column if not exists responsavel_financeiro_id uuid;
alter table public.vehicles add column if not exists responsavel_financeiro_nome text;
comment on column public.vehicles.responsavel_financeiro_id is 'Parceiro RPF (pagamento); pode coincidir com o RPV (localizador_id) ou ser outro.';
comment on column public.vehicles.responsavel_financeiro_nome is 'Nome gravado com o RPF (espelho do parceiro selecionado).';

create table if not exists public.accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  cycle_start_date date not null,
  cycle_end_date date null,
  gross_amount numeric(14,2) not null default 0,
  deduction_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  balance_amount numeric(14,2) not null default 0,
  status text not null default 'OPEN'
    check (status in ('OPEN','AWAITING_PAYMENT','PAID','CLOSED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_receivable_user_vehicle
  on public.accounts_receivable(user_id, vehicle_id, status, created_at desc);

create table if not exists public.daily_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  accounts_receivable_id uuid not null references public.accounts_receivable(id) on delete restrict,
  charge_date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVERSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, vehicle_id, charge_date, status)
);

create index if not exists idx_daily_charges_user_date
  on public.daily_charges(user_id, charge_date desc);

create table if not exists public.revenue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  accounts_receivable_id uuid null references public.accounts_receivable(id) on delete set null,
  revenue_date date not null,
  amount numeric(14,2) not null,
  type text not null check (type in ('DAILY_CHARGE','DEDUCTION','REVERSAL')),
  source_ref text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_revenue_user_date
  on public.revenue(user_id, revenue_date desc);

create table if not exists public.revenue_deductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  accounts_receivable_id uuid not null references public.accounts_receivable(id) on delete restrict,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  deduction_date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  reason text not null,
  is_full_waiver boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_revenue_deductions_user_date
  on public.revenue_deductions(user_id, deduction_date desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  accounts_receivable_id uuid not null references public.accounts_receivable(id) on delete restrict,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  method text not null default 'DINHEIRO',
  status text not null default 'CONFIRMED' check (status in ('CONFIRMED','REVERSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_user_date
  on public.payments(user_id, payment_date desc);

-- Trigger de atualização do updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_accounts_receivable_touch_updated_at on public.accounts_receivable;
create trigger trg_accounts_receivable_touch_updated_at
before update on public.accounts_receivable
for each row execute function public.touch_updated_at();

drop trigger if exists trg_daily_charges_touch_updated_at on public.daily_charges;
create trigger trg_daily_charges_touch_updated_at
before update on public.daily_charges
for each row execute function public.touch_updated_at();

drop trigger if exists trg_payments_touch_updated_at on public.payments;
create trigger trg_payments_touch_updated_at
before update on public.payments
for each row execute function public.touch_updated_at();
