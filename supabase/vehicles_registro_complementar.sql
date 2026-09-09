-- Complemento do registro (CR) no VNP.
-- Idempotente. Não apaga dados. Veículos existentes ficam com registro_concluido NULL
-- e continuam tratados como já concluídos (comportamento legado).

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS registro_concluido boolean;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS patio_parceiro_id uuid;

COMMENT ON COLUMN public.vehicles.registro_concluido IS
  'false = aguardando Concluir Registro (CR). true = complementar gravado. NULL = legado (já concluído).';

COMMENT ON COLUMN public.vehicles.patio_parceiro_id IS
  'Parceiro tipo pátio (partners.id). Opcional. Não altera o pátio operacional do usuário.';

CREATE INDEX IF NOT EXISTS vehicles_registro_concluido_idx
  ON public.vehicles (user_id, registro_concluido);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_patio_parceiro_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_patio_parceiro_id_fkey
      FOREIGN KEY (patio_parceiro_id)
      REFERENCES public.partners (id)
      ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
