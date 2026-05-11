-- Colunas usadas pelo formulário de veículo: vistoria (LV), leiloeiro e RPF.
-- Executar uma vez no SQL Editor do Supabase (idempotente).
-- O mesmo conteúdo está no início de finance_competency_schema.sql antes das tabelas de competência.

-- Laudo de vistoria (ver também vehicles_vistoria.sql, mantido como referência).
alter table public.vehicles add column if not exists vistoria_data timestamptz;
alter table public.vehicles add column if not exists vistoria_responsavel text;
alter table public.vehicles add column if not exists vistoria_km text;
alter table public.vehicles add column if not exists vistoria_combustivel text;
alter table public.vehicles add column if not exists vistoria_checklist jsonb not null default '{}'::jsonb;
alter table public.vehicles add column if not exists vistoria_observacoes text;

comment on column public.vehicles.vistoria_data is 'Data/hora da vistoria no cadastro do veículo.';
comment on column public.vehicles.vistoria_responsavel is 'Nome do responsável pela vistoria.';
comment on column public.vehicles.vistoria_km is 'Quilometragem no momento da vistoria.';
comment on column public.vehicles.vistoria_combustivel is 'Nível de combustível na vistoria.';
comment on column public.vehicles.vistoria_checklist is 'Checklist (documento/chave/estepe/triângulo-macaco).';
comment on column public.vehicles.vistoria_observacoes is 'Avarias e observações da vistoria.';

-- Leiloeiro
alter table public.vehicles add column if not exists leiloeiro_id uuid;
comment on column public.vehicles.leiloeiro_id is 'Parceiro leiloeiro associado ao veículo.';

-- RPF (responsável financeiro / pagamento)
alter table public.vehicles add column if not exists responsavel_financeiro_id uuid;
alter table public.vehicles add column if not exists responsavel_financeiro_nome text;
comment on column public.vehicles.responsavel_financeiro_id is 'Parceiro RPF (pagamento); pode coincidir com o RPV ou ser outro.';
comment on column public.vehicles.responsavel_financeiro_nome is 'Nome gravado com o RPF (espelho do parceiro selecionado).';
