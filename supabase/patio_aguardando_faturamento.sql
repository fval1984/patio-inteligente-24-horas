-- Integração Pátio × Financeiro: Aguardando Faturamento no Pátio.
-- Só cria o que faltar e adiciona colunas. Não apaga registros, não altera status.

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS cobranca_destinatario_nome text;

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS cobranca_destinatario_contato text;

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS tipo_faturamento text;

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS cobranca_emitida boolean NOT NULL DEFAULT false;

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS faturado_em timestamptz;

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS contas_receber_em timestamptz;

-- Esta tabela pode não existir ainda neste projeto. Cria vazia se faltar.
CREATE TABLE IF NOT EXISTS patio_cycle_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  receivable_id uuid NULL,
  responsavel_financeiro text NULL,
  period_start timestamptz NULL,
  period_end timestamptz NULL,
  diarias integer NOT NULL DEFAULT 0,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  nf_emitida boolean NOT NULL DEFAULT false,
  nf_enviada boolean NOT NULL DEFAULT false,
  triagem_ok boolean NOT NULL DEFAULT false,
  sent_to_finance boolean NOT NULL DEFAULT false,
  triaged_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patio_cycle_closures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='patio_cycle_closures' AND policyname='patio_cycle_closures_select_own'
  ) THEN
    CREATE POLICY patio_cycle_closures_select_own ON patio_cycle_closures
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='patio_cycle_closures' AND policyname='patio_cycle_closures_insert_own'
  ) THEN
    CREATE POLICY patio_cycle_closures_insert_own ON patio_cycle_closures
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='patio_cycle_closures' AND policyname='patio_cycle_closures_update_own'
  ) THEN
    CREATE POLICY patio_cycle_closures_update_own ON patio_cycle_closures
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS patio_cycle_closures_user_created_idx
  ON patio_cycle_closures (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS patio_cycle_closures_user_sent_idx
  ON patio_cycle_closures (user_id, sent_to_finance, triagem_ok);

GRANT SELECT, INSERT, UPDATE, DELETE ON patio_cycle_closures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON patio_cycle_closures TO service_role;

ALTER TABLE patio_cycle_closures
  ADD COLUMN IF NOT EXISTS cobranca_destinatario_nome text;

ALTER TABLE patio_cycle_closures
  ADD COLUMN IF NOT EXISTS cobranca_destinatario_contato text;

ALTER TABLE patio_cycle_closures
  ADD COLUMN IF NOT EXISTS tipo_faturamento text;

ALTER TABLE patio_cycle_closures
  ADD COLUMN IF NOT EXISTS cobranca_emitida boolean NOT NULL DEFAULT false;

ALTER TABLE patio_cycle_closures
  ADD COLUMN IF NOT EXISTS faturado_em timestamptz;

COMMENT ON COLUMN receivables.cobranca_destinatario_nome IS
  'Nome de quem recebeu a cobrança/NF ao sair de Aguardando Faturamento (Pátio).';
COMMENT ON COLUMN receivables.cobranca_destinatario_contato IS
  'Contato do destinatário da cobrança/NF.';
COMMENT ON COLUMN receivables.tipo_faturamento IS
  'NF ou COBRANCA — documento emitido no Pátio antes de Contas a Receber.';
