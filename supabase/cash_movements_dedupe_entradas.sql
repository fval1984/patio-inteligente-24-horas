-- Remove entradas duplicadas no caixa (mesmo recebível ou, sem vínculo, veículo + data + valor).
-- Execute no SQL Editor do Supabase se houver duplicatas reais.

WITH movs AS (
  SELECT
    cm.id,
    cm.conta_id,
    cm.tipo_conta,
    cm.valor,
    COALESCE(cm.data_movimento::date, cm.created_at::date) AS mov_date,
    cm.created_at,
    r.vehicle_id,
    upper(regexp_replace(v.placa, '[^A-Z0-9]', '', 'g')) AS placa_key,
    CASE upper(cm.tipo_conta)
      WHEN 'RECEBER' THEN 2
      WHEN 'ENTRADA' THEN 1
      ELSE 0
    END AS tipo_rank
  FROM cash_movements cm
  LEFT JOIN receivables r ON r.id = cm.conta_id
  LEFT JOIN vehicles v ON v.id = r.vehicle_id
  WHERE upper(cm.tipo_conta) IN ('RECEBER', 'ENTRADA')
),
ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        COALESCE(conta_id::text, vehicle_id::text, placa_key, id::text),
        mov_date,
        round(COALESCE(valor, 0)::numeric, 2)
      ORDER BY tipo_rank DESC, created_at DESC, id DESC
    ) AS rn
  FROM movs
)
DELETE FROM cash_movements cm
USING ranked r
WHERE cm.id = r.id
  AND r.rn > 1;
