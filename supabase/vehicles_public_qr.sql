-- QR Code público do registro de pátio (etiquetas AMPLIGUARD).
-- Idempotente. NÃO altera fluxos VNP/VSL/VSC/VRP, financeiro nem vistorias.
-- Executar no Supabase → SQL Editor → Run.

CREATE OR REPLACE FUNCTION public.patio_data_owner_match(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_owner IS NOT NULL AND (
    auth.uid() = p_owner
    OR EXISTS (
      SELECT 1
      FROM public.track_managers tm
      WHERE tm.user_id = auth.uid()
        AND tm.owner_user_id = p_owner
    )
  );
$$;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS public_token text;

COMMENT ON COLUMN public.vehicles.public_token IS
  'Identificador aleatório permanente deste registro de entrada, usado no QR Code público. Não muda em atualizações. Nova entrada da mesma placa recebe outro token.';

UPDATE public.vehicles
SET public_token = encode(gen_random_bytes(24), 'hex')
WHERE public_token IS NULL OR btrim(public_token) = '';

ALTER TABLE public.vehicles
  ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_public_token_uidx
  ON public.vehicles (public_token)
  WHERE public_token IS NOT NULL AND btrim(public_token) <> '';

CREATE OR REPLACE FUNCTION public.vehicles_public_token_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.public_token := encode(gen_random_bytes(24), 'hex');
    RETURN NEW;
  END IF;
  IF OLD.public_token IS NOT NULL AND btrim(OLD.public_token) <> '' THEN
    NEW.public_token := OLD.public_token;
  ELSIF NEW.public_token IS NULL OR btrim(NEW.public_token) = '' THEN
    NEW.public_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicles_public_token_guard ON public.vehicles;
CREATE TRIGGER trg_vehicles_public_token_guard
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE PROCEDURE public.vehicles_public_token_guard();

CREATE OR REPLACE FUNCTION public.ensure_vehicle_public_token(p_vehicle_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner uuid;
  tok text;
BEGIN
  IF p_vehicle_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT user_id, public_token INTO owner, tok
  FROM public.vehicles
  WHERE id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT public.patio_data_owner_match(owner) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF tok IS NULL OR btrim(tok) = '' THEN
    tok := encode(gen_random_bytes(24), 'hex');
    UPDATE public.vehicles
    SET public_token = tok
    WHERE id = p_vehicle_id
      AND (public_token IS NULL OR btrim(public_token) = '');
    SELECT public_token INTO tok FROM public.vehicles WHERE id = p_vehicle_id;
  END IF;

  RETURN tok;
END;
$$;

COMMENT ON FUNCTION public.ensure_vehicle_public_token(uuid) IS
  'Devolve o token público do registro. Gera um se ainda não existir. Só o dono do pátio ou gestor delegado.';

CREATE OR REPLACE FUNCTION public.consultar_historico_publico_veiculo(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
  vid uuid;
  placa text;
  marca text;
  modelo text;
  cor text;
  data_entrada timestamptz;
  data_saida timestamptz;
  status_raw text;
  vsl_em timestamptz;
  vsc_em timestamptz;
  financeira_id uuid;
  leiloeiro_id uuid;
  advocacy_office_id uuid;
  financeira_nome text;
  escritorio_nome text;
  leiloeiro_nome text;
  status_label text;
  ev_vsl timestamptz;
  ev_vsc timestamptz;
  ev_out timestamptz;
  at_vsl timestamptz;
  at_vsc timestamptz;
  at_out timestamptz;
  timeline jsonb := '[]'::jsonb;
  fmt text := 'DD/MM/YYYY HH24:MI';
BEGIN
  tok := lower(btrim(COALESCE(p_token, '')));
  IF tok = '' OR tok !~ '^[0-9a-f]{32,64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT
    v.id,
    v.placa,
    v.marca,
    v.modelo,
    v.cor,
    v.data_entrada,
    v.data_saida,
    v.status,
    v.liberacao_solicitada_em,
    v.liberacao_confirmada_em,
    v.financeira_id,
    v.leiloeiro_id,
    v.advocacy_office_id
  INTO
    vid,
    placa,
    marca,
    modelo,
    cor,
    data_entrada,
    data_saida,
    status_raw,
    vsl_em,
    vsc_em,
    financeira_id,
    leiloeiro_id,
    advocacy_office_id
  FROM public.vehicles v
  WHERE lower(v.public_token) = tok
  LIMIT 1;

  IF vid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF financeira_id IS NOT NULL AND to_regclass('public.partners') IS NOT NULL THEN
    SELECT p.nome INTO financeira_nome FROM public.partners p WHERE p.id = financeira_id;
  END IF;
  IF leiloeiro_id IS NOT NULL AND to_regclass('public.partners') IS NOT NULL THEN
    SELECT p.nome INTO leiloeiro_nome FROM public.partners p WHERE p.id = leiloeiro_id;
  END IF;
  IF advocacy_office_id IS NOT NULL AND to_regclass('public.advocacy_offices') IS NOT NULL THEN
    SELECT ao.name
    INTO escritorio_nome
    FROM public.advocacy_offices ao
    WHERE ao.id = advocacy_office_id;
  END IF;

  status_raw := COALESCE(status_raw, '');
  status_label := CASE status_raw
    WHEN 'NO_PATIO' THEN 'Em guarda no pátio'
    WHEN 'AGUARDANDO_VISTORIA' THEN 'Em guarda no pátio'
    WHEN 'LIBERACAO_SOLICITADA' THEN 'Solicitação de liberação (VSL)'
    WHEN 'LIBERACAO_CONFIRMADA' THEN 'Liberação confirmada'
    WHEN 'REMOCAO_CONFIRMADA' THEN 'Liberação confirmada'
    WHEN 'REMocao_CONFIRMADA' THEN 'Liberação confirmada'
    WHEN 'REMOVIDO' THEN 'Removido / retirado do pátio'
    ELSE COALESCE(NULLIF(status_raw, ''), 'Em guarda no pátio')
  END;

  IF to_regclass('public.vehicle_events') IS NOT NULL THEN
    SELECT
      min(COALESCE(e.data_evento, e.created_at)) FILTER (WHERE e.tipo = 'LIBERACAO_SOLICITADA'),
      min(COALESCE(e.data_evento, e.created_at)) FILTER (WHERE e.tipo = 'LIBERACAO_CONFIRMADA'),
      min(COALESCE(e.data_evento, e.created_at)) FILTER (WHERE e.tipo IN ('REMOVIDO', 'REMocao_CONFIRMADA'))
    INTO ev_vsl, ev_vsc, ev_out
    FROM public.vehicle_events e
    WHERE e.vehicle_id = vid;
  END IF;

  at_vsl := COALESCE(vsl_em, ev_vsl);
  at_vsc := COALESCE(vsc_em, ev_vsc);
  at_out := COALESCE(data_saida, ev_out);

  IF data_entrada IS NOT NULL THEN
    timeline := timeline || jsonb_build_array(jsonb_build_object(
      'code', 'REGISTRADO',
      'title', 'Veículo registrado no pátio',
      'at', data_entrada,
      'at_label', to_char(data_entrada AT TIME ZONE 'America/Recife', fmt)
    ));
    timeline := timeline || jsonb_build_array(jsonb_build_object(
      'code', 'EM_GUARDA',
      'title', 'Veículo em guarda no pátio',
      'at', data_entrada,
      'at_label', to_char(data_entrada AT TIME ZONE 'America/Recife', fmt)
    ));
  END IF;

  IF at_vsl IS NOT NULL THEN
    timeline := timeline || jsonb_build_array(jsonb_build_object(
      'code', 'VSL',
      'title', 'Solicitação de liberação recebida (VSL)',
      'at', at_vsl,
      'at_label', to_char(at_vsl AT TIME ZONE 'America/Recife', fmt)
    ));
  END IF;

  IF at_vsc IS NOT NULL THEN
    timeline := timeline || jsonb_build_array(jsonb_build_object(
      'code', 'VSC',
      'title', 'Liberação confirmada',
      'at', at_vsc,
      'at_label', to_char(at_vsc AT TIME ZONE 'America/Recife', fmt)
    ));
  END IF;

  IF at_out IS NOT NULL THEN
    timeline := timeline || jsonb_build_array(jsonb_build_object(
      'code', 'VRP',
      'title', 'Veículo removido ou retirado do pátio',
      'at', at_out,
      'at_label', to_char(at_out AT TIME ZONE 'America/Recife', fmt)
    ));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'placa', COALESCE(placa, ''),
    'marca', COALESCE(marca, ''),
    'modelo', COALESCE(modelo, ''),
    'cor', COALESCE(cor, ''),
    'data_entrada', data_entrada,
    'data_entrada_label', CASE
      WHEN data_entrada IS NULL THEN NULL
      ELSE to_char(data_entrada AT TIME ZONE 'America/Recife', fmt)
    END,
    'status', status_raw,
    'status_label', status_label,
    'financeira', COALESCE(financeira_nome, ''),
    'escritorio', COALESCE(escritorio_nome, ''),
    'leiloeiro', COALESCE(leiloeiro_nome, ''),
    'timeline', timeline
  );
END;
$$;

COMMENT ON FUNCTION public.consultar_historico_publico_veiculo(text) IS
  'Consulta pública somente leitura do histórico do registro. Não devolve CPF, valores, documentos nem o id interno.';

REVOKE ALL ON FUNCTION public.ensure_vehicle_public_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_vehicle_public_token(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_vehicle_public_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_vehicle_public_token(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.consultar_historico_publico_veiculo(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consultar_historico_publico_veiculo(text) FROM anon;
REVOKE ALL ON FUNCTION public.consultar_historico_publico_veiculo(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_historico_publico_veiculo(text) TO service_role;

NOTIFY pgrst, 'reload schema';
