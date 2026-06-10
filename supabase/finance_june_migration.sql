-- Migração financeira junho/2026: snapshots para reversão + flag em movimentações.
-- Execute no SQL Editor do Supabase ANTES de rodar a migração.

-- Flag: movimentação visível no histórico mas fora do caixa operacional
ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS excluir_do_saldo boolean NOT NULL DEFAULT false;

-- Saldo inicial da fase operacional (0 após reset)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS caixa_opening_balance numeric DEFAULT 0;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS caixa_operational_reset_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cash_movements_excluir_saldo
  ON public.cash_movements (user_id, excluir_do_saldo)
  WHERE excluir_do_saldo = true;

-- Execuções de migração (auditoria)
CREATE TABLE IF NOT EXISTS public.finance_migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  migration_type text NOT NULL DEFAULT 'june_2026_auto_to_aguardando',
  cutoff_ymd text NOT NULL DEFAULT '2026-06-01',
  status text NOT NULL DEFAULT 'preview',
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  rolled_back_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_finance_migration_runs_user
  ON public.finance_migration_runs (user_id, created_at DESC);

-- Snapshot linha a linha para reversão
CREATE TABLE IF NOT EXISTS public.finance_migration_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id uuid NOT NULL REFERENCES public.finance_migration_runs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  payload_before jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_migration_snapshots_run
  ON public.finance_migration_snapshots (migration_id, entity_type);

ALTER TABLE public.finance_migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_migration_snapshots ENABLE ROW LEVEL SECURITY;
