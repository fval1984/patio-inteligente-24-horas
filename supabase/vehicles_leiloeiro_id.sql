-- Leiloeiro no cadastro do veículo (parceiro tipo LEILOEIRO).
-- Executar no SQL Editor do Supabase. Incluído em vehicles_recursos_avancados.sql e no início de finance_competency_schema.sql.

alter table public.vehicles add column if not exists leiloeiro_id uuid;
comment on column public.vehicles.leiloeiro_id is 'Parceiro leiloeiro associado ao veículo.';
