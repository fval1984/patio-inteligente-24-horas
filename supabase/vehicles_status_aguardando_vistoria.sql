-- Adiciona AGUARDANDO_VISTORIA ao enum vehicle_status (cadastro → vistoria → VNP).
-- Executar uma vez no SQL Editor do Supabase se o cadastro falhar com:
--   invalid input value for enum vehicle_status: "AGUARDANDO_VISTORIA"
-- Idempotente. Também incluído no início de vehicle_entry_inspections.sql.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'vehicle_status' AND e.enumlabel = 'AGUARDANDO_VISTORIA'
    ) THEN
      ALTER TYPE vehicle_status ADD VALUE 'AGUARDANDO_VISTORIA';
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
