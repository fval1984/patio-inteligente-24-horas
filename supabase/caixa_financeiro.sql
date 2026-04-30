-- Modulo completo de Caixa Financeiro
-- Execute no SQL Editor do Supabase.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'caixa_status') then
    create type public.caixa_status as enum ('ABERTO', 'FECHADO');
  end if;
  if not exists (select 1 from pg_type where typname = 'caixa_lancamento_tipo') then
    create type public.caixa_lancamento_tipo as enum ('ENTRADA', 'SAIDA');
  end if;
  if not exists (select 1 from pg_type where typname = 'caixa_forma_pagamento') then
    create type public.caixa_forma_pagamento as enum ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA');
  end if;
  if not exists (select 1 from pg_type where typname = 'conta_receber_status') then
    create type public.conta_receber_status as enum ('PENDENTE', 'PAGO', 'ATRASADO');
  end if;
end$$;

create table if not exists public.caixas_financeiros (
  id uuid primary key default gen_random_uuid(),
  data_abertura timestamptz not null default now(),
  data_fechamento timestamptz null,
  saldo_inicial numeric(14,2) not null default 0 check (saldo_inicial >= 0),
  saldo_final numeric(14,2) not null default 0 check (saldo_final >= 0),
  status public.caixa_status not null default 'ABERTO',
  usuario_abertura_id uuid not null,
  usuario_fechamento_id uuid null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garante somente um caixa aberto por usuário.
create unique index if not exists ux_caixa_unico_aberto_por_usuario
on public.caixas_financeiros (usuario_abertura_id)
where status = 'ABERTO' and deleted_at is null;

create table if not exists public.lancamentos_caixa (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixas_financeiros(id),
  tipo public.caixa_lancamento_tipo not null,
  categoria text not null,
  descricao text not null,
  valor numeric(14,2) not null check (valor > 0),
  forma_pagamento public.caixa_forma_pagamento not null,
  data_hora timestamptz not null default now(),
  usuario_id uuid not null,
  referencia_id uuid null,
  referencia_veiculo_id uuid null references public.vehicles(id),
  is_estorno boolean not null default false,
  estornado_lancamento_id uuid null references public.lancamentos_caixa(id),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lancamentos_caixa_caixa_id on public.lancamentos_caixa(caixa_id);
create index if not exists idx_lancamentos_caixa_data on public.lancamentos_caixa(data_hora);
create index if not exists idx_lancamentos_caixa_categoria on public.lancamentos_caixa(categoria);

create table if not exists public.contas_receber_financeiro (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  valor numeric(14,2) not null check (valor > 0),
  status public.conta_receber_status not null default 'PENDENTE',
  data_vencimento date not null,
  data_pagamento timestamptz null,
  referencia_veiculo_id uuid null references public.vehicles(id),
  financeira_id uuid null references public.partners(id),
  caixa_lancamento_id uuid null references public.lancamentos_caixa(id),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contas_receber_vencimento on public.contas_receber_financeiro(data_vencimento);
create index if not exists idx_contas_receber_status on public.contas_receber_financeiro(status);

create table if not exists public.caixa_fechamentos (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null unique references public.caixas_financeiros(id),
  usuario_id uuid not null,
  total_sistema numeric(14,2) not null default 0,
  total_informado numeric(14,2) not null default 0,
  diferenca numeric(14,2) not null default 0,
  total_dinheiro numeric(14,2) not null default 0,
  total_pix numeric(14,2) not null default 0,
  total_debito numeric(14,2) not null default 0,
  total_credito numeric(14,2) not null default 0,
  total_transferencia numeric(14,2) not null default 0,
  observacoes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.caixa_auditoria_logs (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  entidade_id uuid null,
  acao text not null,
  usuario_id uuid null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create or replace function public.fn_caixa_log_acao(
  p_entidade text,
  p_entidade_id uuid,
  p_acao text,
  p_usuario_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
as $$
begin
  insert into public.caixa_auditoria_logs(entidade, entidade_id, acao, usuario_id, payload)
  values (p_entidade, p_entidade_id, p_acao, p_usuario_id, p_payload);
end;
$$;

create or replace function public.fn_caixa_recalcular_saldo(p_caixa_id uuid)
returns numeric
language plpgsql
as $$
declare
  v_saldo_inicial numeric(14,2);
  v_entradas numeric(14,2);
  v_saidas numeric(14,2);
  v_saldo_final numeric(14,2);
begin
  select saldo_inicial into v_saldo_inicial from public.caixas_financeiros where id = p_caixa_id;
  if v_saldo_inicial is null then
    return 0;
  end if;

  select coalesce(sum(valor), 0) into v_entradas
  from public.lancamentos_caixa
  where caixa_id = p_caixa_id and tipo = 'ENTRADA' and deleted_at is null;

  select coalesce(sum(valor), 0) into v_saidas
  from public.lancamentos_caixa
  where caixa_id = p_caixa_id and tipo = 'SAIDA' and deleted_at is null;

  v_saldo_final := v_saldo_inicial + v_entradas - v_saidas;

  update public.caixas_financeiros
  set saldo_final = greatest(v_saldo_final, 0),
      updated_at = now()
  where id = p_caixa_id;

  return greatest(v_saldo_final, 0);
end;
$$;

create or replace function public.fn_caixa_validar_lancamento()
returns trigger
language plpgsql
as $$
declare
  v_status public.caixa_status;
begin
  select status into v_status from public.caixas_financeiros where id = new.caixa_id and deleted_at is null;
  if v_status is null then
    raise exception 'Caixa inexistente.';
  end if;
  if v_status <> 'ABERTO' then
    raise exception 'Não é permitido lançar em caixa fechado.';
  end if;
  if new.valor <= 0 then
    raise exception 'Valor do lançamento deve ser positivo.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_caixa_validar_lancamento on public.lancamentos_caixa;
create trigger trg_caixa_validar_lancamento
before insert or update on public.lancamentos_caixa
for each row execute function public.fn_caixa_validar_lancamento();

create or replace function public.fn_caixa_pos_lancamento()
returns trigger
language plpgsql
as $$
declare
  v_caixa_id uuid;
  v_usuario_id uuid;
begin
  v_caixa_id := coalesce(new.caixa_id, old.caixa_id);
  v_usuario_id := coalesce(new.usuario_id, old.usuario_id);
  perform public.fn_caixa_recalcular_saldo(v_caixa_id);

  perform public.fn_caixa_log_acao(
    'lancamentos_caixa',
    coalesce(new.id, old.id),
    tg_op,
    v_usuario_id,
    jsonb_build_object('new', to_jsonb(new), 'old', to_jsonb(old))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_caixa_pos_lancamento on public.lancamentos_caixa;
create trigger trg_caixa_pos_lancamento
after insert or update or delete on public.lancamentos_caixa
for each row execute function public.fn_caixa_pos_lancamento();

create or replace function public.fn_conta_receber_status_atraso()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'PENDENTE' and new.data_vencimento < current_date then
    new.status := 'ATRASADO';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_conta_receber_status_atraso on public.contas_receber_financeiro;
create trigger trg_conta_receber_status_atraso
before insert or update on public.contas_receber_financeiro
for each row execute function public.fn_conta_receber_status_atraso();

create or replace function public.fn_conta_receber_marcar_pago(
  p_conta_id uuid,
  p_usuario_id uuid,
  p_forma_pagamento public.caixa_forma_pagamento default 'PIX',
  p_caixa_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_conta record;
  v_caixa_id uuid;
  v_lancamento_id uuid;
begin
  select * into v_conta
  from public.contas_receber_financeiro
  where id = p_conta_id and deleted_at is null;

  if v_conta.id is null then
    raise exception 'Conta a receber não encontrada.';
  end if;
  if v_conta.status = 'PAGO' then
    return v_conta.caixa_lancamento_id;
  end if;

  if p_caixa_id is not null then
    v_caixa_id := p_caixa_id;
  else
    select id into v_caixa_id
    from public.caixas_financeiros
    where usuario_abertura_id = p_usuario_id
      and status = 'ABERTO'
      and deleted_at is null
    limit 1;
  end if;

  if v_caixa_id is null then
    raise exception 'Nenhum caixa aberto para registrar o recebimento.';
  end if;

  insert into public.lancamentos_caixa (
    caixa_id, tipo, categoria, descricao, valor, forma_pagamento, usuario_id, referencia_id, referencia_veiculo_id
  ) values (
    v_caixa_id,
    'ENTRADA',
    'SERVICO',
    'Recebimento automático de conta a receber',
    v_conta.valor,
    p_forma_pagamento,
    p_usuario_id,
    v_conta.id,
    v_conta.referencia_veiculo_id
  )
  returning id into v_lancamento_id;

  update public.contas_receber_financeiro
  set status = 'PAGO',
      data_pagamento = now(),
      caixa_lancamento_id = v_lancamento_id,
      updated_at = now()
  where id = v_conta.id;

  perform public.fn_caixa_log_acao(
    'contas_receber_financeiro',
    v_conta.id,
    'MARCAR_PAGO',
    p_usuario_id,
    jsonb_build_object('caixa_id', v_caixa_id, 'lancamento_id', v_lancamento_id)
  );

  return v_lancamento_id;
end;
$$;

create or replace function public.fn_caixa_fechar(
  p_caixa_id uuid,
  p_usuario_id uuid,
  p_total_dinheiro numeric,
  p_total_pix numeric,
  p_total_debito numeric,
  p_total_credito numeric,
  p_total_transferencia numeric,
  p_observacoes text default null
)
returns uuid
language plpgsql
as $$
declare
  v_caixa record;
  v_total_sistema numeric(14,2);
  v_total_informado numeric(14,2);
  v_diferenca numeric(14,2);
  v_fechamento_id uuid;
begin
  select * into v_caixa from public.caixas_financeiros where id = p_caixa_id and deleted_at is null for update;
  if v_caixa.id is null then
    raise exception 'Caixa não encontrado.';
  end if;
  if v_caixa.status <> 'ABERTO' then
    raise exception 'Caixa já está fechado.';
  end if;

  v_total_sistema := public.fn_caixa_recalcular_saldo(p_caixa_id);
  v_total_informado := coalesce(p_total_dinheiro,0) + coalesce(p_total_pix,0) + coalesce(p_total_debito,0) + coalesce(p_total_credito,0) + coalesce(p_total_transferencia,0);
  v_diferenca := v_total_informado - v_total_sistema;

  insert into public.caixa_fechamentos (
    caixa_id, usuario_id, total_sistema, total_informado, diferenca,
    total_dinheiro, total_pix, total_debito, total_credito, total_transferencia, observacoes
  ) values (
    p_caixa_id, p_usuario_id, v_total_sistema, v_total_informado, v_diferenca,
    coalesce(p_total_dinheiro,0), coalesce(p_total_pix,0), coalesce(p_total_debito,0), coalesce(p_total_credito,0), coalesce(p_total_transferencia,0), p_observacoes
  ) returning id into v_fechamento_id;

  update public.caixas_financeiros
  set status = 'FECHADO',
      data_fechamento = now(),
      usuario_fechamento_id = p_usuario_id,
      saldo_final = v_total_sistema,
      updated_at = now()
  where id = p_caixa_id;

  perform public.fn_caixa_log_acao(
    'caixas_financeiros',
    p_caixa_id,
    'FECHAMENTO',
    p_usuario_id,
    jsonb_build_object('fechamento_id', v_fechamento_id, 'diferenca', v_diferenca)
  );

  return v_fechamento_id;
end;
$$;

-- RLS básico
alter table public.caixas_financeiros enable row level security;
alter table public.lancamentos_caixa enable row level security;
alter table public.contas_receber_financeiro enable row level security;
alter table public.caixa_fechamentos enable row level security;
alter table public.caixa_auditoria_logs enable row level security;

drop policy if exists pol_caixa_select on public.caixas_financeiros;
create policy pol_caixa_select on public.caixas_financeiros for select using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists pol_caixa_write on public.caixas_financeiros;
create policy pol_caixa_write on public.caixas_financeiros for all using (auth.role() in ('authenticated', 'service_role')) with check (auth.role() in ('authenticated', 'service_role'));

drop policy if exists pol_lancamento_select on public.lancamentos_caixa;
create policy pol_lancamento_select on public.lancamentos_caixa for select using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists pol_lancamento_write on public.lancamentos_caixa;
create policy pol_lancamento_write on public.lancamentos_caixa for all using (auth.role() in ('authenticated', 'service_role')) with check (auth.role() in ('authenticated', 'service_role'));

drop policy if exists pol_contas_receber_select on public.contas_receber_financeiro;
create policy pol_contas_receber_select on public.contas_receber_financeiro for select using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists pol_contas_receber_write on public.contas_receber_financeiro;
create policy pol_contas_receber_write on public.contas_receber_financeiro for all using (auth.role() in ('authenticated', 'service_role')) with check (auth.role() in ('authenticated', 'service_role'));

drop policy if exists pol_caixa_fechamento_select on public.caixa_fechamentos;
create policy pol_caixa_fechamento_select on public.caixa_fechamentos for select using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists pol_caixa_fechamento_write on public.caixa_fechamentos;
create policy pol_caixa_fechamento_write on public.caixa_fechamentos for all using (auth.role() in ('authenticated', 'service_role')) with check (auth.role() in ('authenticated', 'service_role'));

drop policy if exists pol_caixa_log_select on public.caixa_auditoria_logs;
create policy pol_caixa_log_select on public.caixa_auditoria_logs for select using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists pol_caixa_log_write on public.caixa_auditoria_logs;
create policy pol_caixa_log_write on public.caixa_auditoria_logs for all using (auth.role() in ('authenticated', 'service_role')) with check (auth.role() in ('authenticated', 'service_role'));

