-- Reset do caixa: backup, pré-visualização e execução manual
-- Substitua :USER_ID pelo uuid do usuário (auth.users.id)
-- Mês marco: mês atual (ex.: 2026-06)

-- ============================================================
-- 0) Schema: marco do reset + tabela de backup
-- ============================================================
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS caixa_reset_ym text;

CREATE TABLE IF NOT EXISTS public.cash_movements_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_run_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_id uuid NOT NULL,
  payload jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_archive_user_run
  ON public.cash_movements_archive(user_id, backup_run_id);

ALTER TABLE public.cash_movements_archive ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1) BACKUP COMPLETO (executar primeiro — não apaga nada)
-- ============================================================
-- Opção A: tabela espelho datada
CREATE TABLE IF NOT EXISTS public.cash_movements_backup_manual AS
SELECT * FROM public.cash_movements WHERE false;

INSERT INTO public.cash_movements_backup_manual
SELECT * FROM public.cash_movements
WHERE user_id = ':USER_ID';

SELECT COUNT(*) AS backup_rows FROM public.cash_movements_backup_manual WHERE user_id = ':USER_ID';

-- Opção B: arquivo JSON na tabela archive (usada pela API)
-- INSERT INTO cash_movements_archive (backup_run_id, user_id, original_id, payload)
-- SELECT 'manual_' || to_char(now(), 'YYYYMMDD'), user_id, id, to_jsonb(cm.*)
-- FROM cash_movements cm WHERE user_id = ':USER_ID';

-- ============================================================
-- 2) PRÉ-VISUALIZAÇÃO — o que será removido
-- ============================================================
SELECT id, tipo_conta, conta_id, valor, data_movimento, descricao, created_at
FROM public.cash_movements
WHERE user_id = ':USER_ID'
ORDER BY COALESCE(data_movimento, created_at::date);

SELECT
  COUNT(*) AS total_remover,
  COUNT(*) FILTER (WHERE UPPER(tipo_conta) IN ('RECEBER','ENTRADA')) AS entradas_remover,
  COUNT(*) FILTER (WHERE UPPER(tipo_conta) IN ('PAGAR','SAIDA','SAÍDA')) AS saidas_remover,
  COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('RECEBER','ENTRADA') THEN valor ELSE 0 END), 0) AS total_entradas,
  COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('PAGAR','SAIDA','SAÍDA') THEN valor ELSE 0 END), 0) AS total_saidas
FROM public.cash_movements
WHERE user_id = ':USER_ID';

-- ============================================================
-- 3) PRÉ-VISUALIZAÇÃO — o que será recriado (recebíveis PAGO no mês atual)
-- ============================================================
-- Ajuste :RESET_YM (ex.: 2026-06)
SELECT r.id, r.valor, r.status, r.period_end, r.updated_at, v.placa
FROM public.receivables r
LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
WHERE r.user_id = ':USER_ID'
  AND r.status = 'PAGO'
  AND r.valor > 0
  AND to_char(COALESCE(r.period_end::date, r.updated_at::date), 'YYYY-MM') = ':RESET_YM';

-- ============================================================
-- 4) EXECUÇÃO (somente após confirmar backup + pré-visualização)
-- ============================================================
BEGIN;

DELETE FROM public.cash_movements WHERE user_id = ':USER_ID';

-- Inserir entradas do mês (gerar via API /api/finance/caixa-reset/preview ou repetir INSERTs da prévia)

UPDATE public.settings
SET caixa_reset_ym = ':RESET_YM'
WHERE user_id = ':USER_ID';

COMMIT;

-- ============================================================
-- 5) VALIDAÇÃO pós-reset
-- ============================================================
SELECT
  COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('RECEBER','ENTRADA') THEN valor ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('PAGAR','SAIDA','SAÍDA') THEN valor ELSE 0 END), 0) AS saldo_atual
FROM public.cash_movements
WHERE user_id = ':USER_ID';

SELECT * FROM public.cash_movements
WHERE user_id = ':USER_ID'
  AND to_char(COALESCE(data_movimento, created_at::date), 'YYYY-MM') = ':RESET_YM'
ORDER BY data_movimento;
