-- Financeiro v2 - base robusta para competência mensal, previsto x realizado
-- Executar no SQL Editor do Supabase.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'financeiro_tipo' and n.nspname = 'public'
  ) then
    create type public.financeiro_tipo as enum ('RECEITA', 'DESPESA');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'financeiro_status' and n.nspname = 'public'
  ) then
    create type public.financeiro_status as enum ('PENDENTE', 'REALIZADO');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'financeiro_conta_tipo' and n.nspname = 'public'
  ) then
    create type public.financeiro_conta_tipo as enum ('RECEBER', 'PAGAR');
  end if;
end$$;

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo public.financeiro_tipo not null,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nome, tipo)
);

create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  tipo public.financeiro_conta_tipo not null,
  descricao text not null,
  valor numeric(14,2) not null check (valor >= 0),
  vencimento date not null,
  status public.financeiro_status not null default 'PENDENTE',
  recorrencia text not null default 'NAO',
  categoria_id uuid null references public.categorias(id) on delete set null,
  veiculo_id uuid null references public.vehicles(id) on delete set null,
  financeira_id uuid null references public.partners(id) on delete set null,
  competencia text not null,
  mes int not null check (mes between 1 and 12),
  ano int not null check (ano between 2000 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transacoes (
  id uuid primary key default gen_random_uuid(),
  data_movimento date not null,
  valor numeric(14,2) not null check (valor >= 0),
  tipo public.financeiro_tipo not null,
  status public.financeiro_status not null default 'REALIZADO',
  descricao text not null,
  categoria_id uuid null references public.categorias(id) on delete set null,
  conta_id uuid null references public.contas(id) on delete set null,
  veiculo_id uuid null references public.vehicles(id) on delete set null,
  origem_evento text not null default 'MANUAL',
  chave_idempotencia text null,
  competencia text not null,
  mes int not null check (mes between 1 and 12),
  ano int not null check (ano between 2000 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chave_idempotencia)
);

create index if not exists idx_contas_competencia on public.contas(competencia);
create index if not exists idx_contas_vencimento on public.contas(vencimento);
create index if not exists idx_contas_status on public.contas(status);
create index if not exists idx_contas_tipo on public.contas(tipo);

create index if not exists idx_transacoes_competencia on public.transacoes(competencia);
create index if not exists idx_transacoes_data on public.transacoes(data_movimento);
create index if not exists idx_transacoes_tipo on public.transacoes(tipo);
create index if not exists idx_transacoes_status on public.transacoes(status);
create index if not exists idx_transacoes_veiculo on public.transacoes(veiculo_id);

create or replace function public.fn_financeiro_set_competencia_fields()
returns trigger
language plpgsql
as $$
declare
  d date;
begin
  if tg_table_name = 'transacoes' then
    d := coalesce(new.data_movimento, current_date);
  else
    d := coalesce(new.vencimento, current_date);
  end if;

  new.mes := extract(month from d)::int;
  new.ano := extract(year from d)::int;
  new.competencia := to_char(d, 'YYYY-MM');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_financeiro_comp_transacoes on public.transacoes;
create trigger trg_financeiro_comp_transacoes
before insert or update on public.transacoes
for each row execute function public.fn_financeiro_set_competencia_fields();

drop trigger if exists trg_financeiro_comp_contas on public.contas;
create trigger trg_financeiro_comp_contas
before insert or update on public.contas
for each row execute function public.fn_financeiro_set_competencia_fields();

create or replace view public.v_contas_atrasadas as
select
  c.*,
  (current_date - c.vencimento) as dias_atraso
from public.contas c
where c.status = 'PENDENTE' and c.vencimento < current_date;

-- Integração automática com veículos (entrada/saída/liberação).
-- O trigger não usa referências fixas de colunas para evitar quebrar esquemas legados.
create or replace function public.fn_financeiro_integrar_veiculo()
returns trigger
language plpgsql
as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_id uuid;
  entrada text;
  saida text;
  valor_diaria numeric(14,2);
  dias integer;
  diaria_total numeric(14,2);
  chave text;
begin
  v_id := (n->>'id')::uuid;
  entrada := n->>'data_entrada';
  saida := n->>'data_saida';
  valor_diaria := coalesce((n->>'valor_diaria')::numeric, 0);

  if v_id is null then
    return new;
  end if;

  -- Evento de custo automático ao cadastrar veículo.
  if tg_op = 'INSERT' then
    chave := 'veiculo:entrada:' || v_id::text;
    insert into public.transacoes (
      data_movimento, valor, tipo, status, descricao, veiculo_id, origem_evento, chave_idempotencia
    )
    values (
      coalesce(entrada::date, current_date),
      0,
      'DESPESA',
      'REALIZADO',
      'Custo inicial automático do veículo no pátio',
      v_id,
      'VEICULO_ENTRADA',
      chave
    )
    on conflict (chave_idempotencia) do nothing;
  end if;

  -- Evento de receita automática na saída/liberação do veículo.
  if (tg_op = 'UPDATE') and (coalesce(o->>'data_saida', '') = '') and (coalesce(saida, '') <> '') then
    if entrada is not null then
      dias := greatest(1, (saida::date - entrada::date));
      diaria_total := dias * greatest(valor_diaria, 0);
      chave := 'veiculo:saida:' || v_id::text || ':' || saida;
      insert into public.transacoes (
        data_movimento, valor, tipo, status, descricao, veiculo_id, origem_evento, chave_idempotencia
      )
      values (
        saida::date,
        diaria_total,
        'RECEITA',
        'PENDENTE',
        format('Receita automática por diária (%s dia(s) x %s)', dias, valor_diaria),
        v_id,
        'VEICULO_LIBERACAO',
        chave
      )
      on conflict (chave_idempotencia) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_financeiro_integrar_veiculo on public.vehicles;
create trigger trg_financeiro_integrar_veiculo
after insert or update on public.vehicles
for each row execute function public.fn_financeiro_integrar_veiculo();

-- RLS básico (ajustar para owner_user_id se usar multitenancy por dono).
alter table public.categorias enable row level security;
alter table public.contas enable row level security;
alter table public.transacoes enable row level security;

drop policy if exists pol_categorias_select on public.categorias;
create policy pol_categorias_select on public.categorias for select using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists pol_categorias_write on public.categorias;
create policy pol_categorias_write on public.categorias for all using (auth.role() in ('authenticated', 'service_role')) with check (auth.role() in ('authenticated', 'service_role'));

drop policy if exists pol_contas_select on public.contas;
create policy pol_contas_select on public.contas for select using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists pol_contas_write on public.contas;
create policy pol_contas_write on public.contas for all using (auth.role() in ('authenticated', 'service_role')) with check (auth.role() in ('authenticated', 'service_role'));

drop policy if exists pol_transacoes_select on public.transacoes;
create policy pol_transacoes_select on public.transacoes for select using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists pol_transacoes_write on public.transacoes;
create policy pol_transacoes_write on public.transacoes for all using (auth.role() in ('authenticated', 'service_role')) with check (auth.role() in ('authenticated', 'service_role'));

