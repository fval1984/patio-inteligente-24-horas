-- Upgrade para suportar tipos de movimentacao no Caixa.
-- Execute apos o script base de caixa_financeiro.sql.

alter type public.caixa_lancamento_tipo add value if not exists 'SANGRIA';
alter type public.caixa_lancamento_tipo add value if not exists 'REFORCO';

alter table public.lancamentos_caixa
  add column if not exists tipo_movimentacao public.caixa_lancamento_tipo;

update public.lancamentos_caixa
set tipo_movimentacao = case
  when tipo = 'ENTRADA' then 'ENTRADA'::public.caixa_lancamento_tipo
  when tipo = 'SAIDA' then 'SAIDA'::public.caixa_lancamento_tipo
  else 'ENTRADA'::public.caixa_lancamento_tipo
end
where tipo_movimentacao is null;

alter table public.lancamentos_caixa
  alter column tipo_movimentacao set default 'ENTRADA';

alter table public.lancamentos_caixa
  alter column tipo_movimentacao set not null;

create index if not exists idx_lancamentos_caixa_tipo_movimentacao
on public.lancamentos_caixa(tipo_movimentacao);

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
  where caixa_id = p_caixa_id and tipo_movimentacao in ('ENTRADA', 'REFORCO') and deleted_at is null;

  select coalesce(sum(valor), 0) into v_saidas
  from public.lancamentos_caixa
  where caixa_id = p_caixa_id and tipo_movimentacao in ('SAIDA', 'SANGRIA') and deleted_at is null;

  v_saldo_final := v_saldo_inicial + v_entradas - v_saidas;

  update public.caixas_financeiros
  set saldo_final = greatest(v_saldo_final, 0),
      updated_at = now()
  where id = p_caixa_id;

  return greatest(v_saldo_final, 0);
end;
$$;

