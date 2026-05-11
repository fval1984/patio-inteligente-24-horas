-- Controlo duplo financeiro: movimentos do PÁTIO (espelho automático do caixa)
-- e movimentos MANUAIS no financeiro, com cruzamento opcional (par_movimento_id).

create table if not exists public.financeiro_movimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origem text not null check (origem in ('PATIO', 'MANUAL')),
  direcao text not null check (direcao in ('ENTRADA', 'SAIDA')),
  valor numeric(14,2) not null check (valor > 0),
  data_mov timestamptz not null default now(),
  descricao text not null default '',
  detalhe jsonb not null default '{}'::jsonb,
  vehicle_id uuid null references public.vehicles (id) on delete set null,
  receivable_id uuid null references public.receivables (id) on delete set null,
  cash_movement_id uuid null unique,
  par_movimento_id uuid null references public.financeiro_movimentos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_fin_mov_user_data on public.financeiro_movimentos (user_id, data_mov desc);
create index if not exists idx_fin_mov_user_origem on public.financeiro_movimentos (user_id, origem);
create index if not exists idx_fin_mov_par on public.financeiro_movimentos (par_movimento_id)
  where par_movimento_id is not null and deleted_at is null;

comment on table public.financeiro_movimentos is
  'PATIO: gerado por trigger a partir de cash_movements. MANUAL: lançado no app. par_movimento_id num manual aponta para o id de uma linha PATIO.';

-- Gatilho: cada movimento de caixa RECEBER/PAGAR gera linha PATIO (idempotente por cash_movement_id).
create or replace function public.fn_financeiro_movimentos_from_caixa()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rec uuid;
  v_veh uuid;
  v_dir text;
  v_desc text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;
  if new.tipo_conta = 'RECEBER' and coalesce(new.valor, 0) > 0 then
    v_dir := 'ENTRADA';
  elsif new.tipo_conta = 'PAGAR' and coalesce(new.valor, 0) > 0 then
    v_dir := 'SAIDA';
  else
    return new;
  end if;

  if exists (
    select 1 from public.financeiro_movimentos m
    where m.cash_movement_id = new.id and m.deleted_at is null
  ) then
    return new;
  end if;

  v_rec := null;
  v_veh := null;
  if new.tipo_conta = 'RECEBER' and new.conta_id is not null then
    select r.id, r.vehicle_id into v_rec, v_veh
    from public.receivables r
    where r.id = new.conta_id and r.user_id = new.user_id
    limit 1;
  end if;

  v_desc := coalesce(nullif(trim(new.descricao), ''), case when v_dir = 'ENTRADA' then 'Entrada caixa (pátio)' else 'Saída caixa (pátio)' end);

  insert into public.financeiro_movimentos (
    user_id, origem, direcao, valor, data_mov, descricao, detalhe,
    vehicle_id, receivable_id, cash_movement_id
  ) values (
    new.user_id,
    'PATIO',
    v_dir,
    new.valor,
    coalesce(new.data_movimento, new.created_at, now()),
    v_desc,
    jsonb_build_object(
      'tipo_conta', new.tipo_conta,
      'forma_pagamento', new.forma_pagamento,
      'conta_id', new.conta_id,
      'cash_movement_id', new.id
    ),
    v_veh,
    v_rec,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_financeiro_movimentos_from_caixa on public.cash_movements;
create trigger trg_financeiro_movimentos_from_caixa
after insert on public.cash_movements
for each row execute function public.fn_financeiro_movimentos_from_caixa();

alter table public.financeiro_movimentos enable row level security;

drop policy if exists pol_fin_mov_select on public.financeiro_movimentos;
create policy pol_fin_mov_select on public.financeiro_movimentos
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists pol_fin_mov_insert on public.financeiro_movimentos;
create policy pol_fin_mov_insert on public.financeiro_movimentos
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists pol_fin_mov_update on public.financeiro_movimentos;
create policy pol_fin_mov_update on public.financeiro_movimentos
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pol_fin_mov_delete on public.financeiro_movimentos;
create policy pol_fin_mov_delete on public.financeiro_movimentos
  for delete to authenticated using (auth.uid() = user_id);
