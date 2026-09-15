-- Colunas em falta: parceiros + veículo (financeira, CR, RPP, escritório, leiloeiro).
-- Supabase → SQL Editor → cole este ficheiro → Run.
-- Idempotente. Não apaga dados. Pode correr mais de uma vez.

-- Parceiros (cadastro inteligente + nome fantasia)
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS status text DEFAULT 'ATIVO';
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS observacoes text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS perfil jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS contatos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS documentos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS historico jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS nome_fantasia text;

UPDATE public.partners
SET tipo = 'LOCALIZADOR'
WHERE upper(trim(COALESCE(tipo, ''))) IN ('PARCEIRO', '');

UPDATE public.partners
SET tipo = 'GUINCHEIRO'
WHERE upper(trim(COALESCE(tipo, ''))) = 'REMOCAO';

UPDATE public.partners
SET status = 'ATIVO'
WHERE status IS NULL OR btrim(status) = '';

-- Veículo: financeira, pátio, CR, RPP, leiloeiro, escritório
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS financeira_id uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS patio_parceiro_id uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS registro_concluido boolean;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS leiloeiro_id uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS responsavel_financeiro_id uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS responsavel_financeiro_nome text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS advocacy_office_id uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS advocacy_office_manager_id uuid;

COMMENT ON COLUMN public.vehicles.financeira_id IS
  'Parceiro tipo instituição financeira (partners.id) a que o veículo pertence.';
COMMENT ON COLUMN public.vehicles.patio_parceiro_id IS
  'Parceiro tipo pátio (partners.id). Opcional.';
COMMENT ON COLUMN public.vehicles.registro_concluido IS
  'false = aguardando Concluir Registro (CR). true = complementar gravado. NULL = legado.';
COMMENT ON COLUMN public.vehicles.leiloeiro_id IS
  'Parceiro leiloeiro associado ao veículo.';
COMMENT ON COLUMN public.vehicles.responsavel_financeiro_id IS
  'RPP — responsável financeiro / pagamento.';
COMMENT ON COLUMN public.vehicles.responsavel_financeiro_nome IS
  'Nome gravado junto ao RPP.';
COMMENT ON COLUMN public.vehicles.advocacy_office_id IS
  'Escritório de advocacia da demanda.';
COMMENT ON COLUMN public.vehicles.advocacy_office_manager_id IS
  'Gestor de carteira do escritório. NULL = sem gestor.';

CREATE INDEX IF NOT EXISTS vehicles_financeira_id_idx ON public.vehicles (financeira_id);
CREATE INDEX IF NOT EXISTS vehicles_registro_concluido_idx ON public.vehicles (user_id, registro_concluido);
CREATE INDEX IF NOT EXISTS vehicles_advocacy_office_id_idx ON public.vehicles (advocacy_office_id);
CREATE INDEX IF NOT EXISTS vehicles_advocacy_office_manager_id_idx ON public.vehicles (advocacy_office_manager_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_financeira_id_fkey') THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_financeira_id_fkey
      FOREIGN KEY (financeira_id) REFERENCES public.partners (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_patio_parceiro_id_fkey') THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_patio_parceiro_id_fkey
      FOREIGN KEY (patio_parceiro_id) REFERENCES public.partners (id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'advocacy_offices'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_advocacy_office_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_advocacy_office_id_fkey
      FOREIGN KEY (advocacy_office_id) REFERENCES public.advocacy_offices (id) ON DELETE RESTRICT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'advocacy_office_managers'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_advocacy_office_manager_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_advocacy_office_manager_id_fkey
      FOREIGN KEY (advocacy_office_manager_id) REFERENCES public.advocacy_office_managers (id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
