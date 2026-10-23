-- Numeração do recibo oficial AMPLIGUARD (modelo visual).
-- Não altera CDF, Entradas, caixa, veículos nem o recibo financeiro (payment_receipts).

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

CREATE TABLE IF NOT EXISTS public.ampliguard_recibo_counters (
  user_id uuid NOT NULL,
  ano integer NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, ano)
);

COMMENT ON TABLE public.ampliguard_recibo_counters IS
  'Contador atômico do recibo oficial, por proprietário e ano. Não reinicia ao atualizar a página.';

CREATE TABLE IF NOT EXISTS public.ampliguard_recibos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  numero text NOT NULL,
  seq integer NOT NULL,
  ano integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT ampliguard_recibos_seq_pos CHECK (seq > 0),
  CONSTRAINT ampliguard_recibos_user_vehicle_uidx UNIQUE (user_id, vehicle_id),
  CONSTRAINT ampliguard_recibos_user_ano_seq_uidx UNIQUE (user_id, ano, seq)
);

COMMENT ON TABLE public.ampliguard_recibos IS
  'Número oficial do recibo AMPLIGUARD por veículo. Reimpressão devolve o mesmo número.';

CREATE INDEX IF NOT EXISTS ampliguard_recibos_user_ano_idx
  ON public.ampliguard_recibos (user_id, ano, seq DESC);

ALTER TABLE public.ampliguard_recibo_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ampliguard_recibos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ampliguard_recibos_select_own ON public.ampliguard_recibos;
CREATE POLICY ampliguard_recibos_select_own
  ON public.ampliguard_recibos
  FOR SELECT
  TO authenticated
  USING (public.patio_data_owner_match(user_id));

REVOKE ALL ON public.ampliguard_recibo_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ampliguard_recibos TO authenticated;

DROP FUNCTION IF EXISTS public.assign_ampliguard_recibo_numero(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.assign_ampliguard_recibo_numero(
  p_user uuid,
  p_vehicle uuid,
  p_known text DEFAULT NULL,
  p_floor integer DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano integer;
  v_exist text;
  v_known text;
  v_known_seq integer;
  v_known_ano integer;
  v_seq integer;
  v_numero text;
  v_floor integer;
BEGIN
  IF p_user IS NULL OR p_vehicle IS NULL OR NOT public.patio_data_owner_match(p_user) THEN
    RAISE EXCEPTION 'sem permissão para numerar recibo';
  END IF;

  v_ano := EXTRACT(YEAR FROM timezone('America/Recife', now()))::integer;
  v_floor := GREATEST(COALESCE(p_floor, 0), 0);

  SELECT numero INTO v_exist
  FROM public.ampliguard_recibos
  WHERE user_id = p_user AND vehicle_id = p_vehicle
  FOR UPDATE;

  IF FOUND THEN
    RETURN v_exist;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ampliguard_recibo:' || p_user::text));

  SELECT numero INTO v_exist
  FROM public.ampliguard_recibos
  WHERE user_id = p_user AND vehicle_id = p_vehicle;

  IF FOUND THEN
    RETURN v_exist;
  END IF;

  v_known := btrim(COALESCE(p_known, ''));
  IF v_known ~ '^[0-9]{1,6}/[0-9]{4}$' THEN
    v_known_seq := split_part(v_known, '/', 1)::integer;
    v_known_ano := split_part(v_known, '/', 2)::integer;
    IF v_known_seq > 0 THEN
      v_numero := lpad(v_known_seq::text, 4, '0') || '/' || v_known_ano::text;
      IF NOT EXISTS (
        SELECT 1
        FROM public.ampliguard_recibos
        WHERE user_id = p_user AND ano = v_known_ano AND seq = v_known_seq
      ) THEN
        BEGIN
          INSERT INTO public.ampliguard_recibos (user_id, vehicle_id, numero, seq, ano)
          VALUES (p_user, p_vehicle, v_numero, v_known_seq, v_known_ano);
          IF v_known_ano = v_ano THEN
            INSERT INTO public.ampliguard_recibo_counters (user_id, ano, last_seq)
            VALUES (p_user, v_ano, GREATEST(v_known_seq, v_floor))
            ON CONFLICT (user_id, ano) DO UPDATE
              SET last_seq = GREATEST(public.ampliguard_recibo_counters.last_seq, EXCLUDED.last_seq);
          END IF;
          RETURN v_numero;
        EXCEPTION
          WHEN unique_violation THEN
            SELECT numero INTO v_exist
            FROM public.ampliguard_recibos
            WHERE user_id = p_user AND vehicle_id = p_vehicle;
            IF FOUND THEN
              RETURN v_exist;
            END IF;
        END;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.ampliguard_recibo_counters (user_id, ano, last_seq)
  SELECT p_user, v_ano, GREATEST(v_floor, COALESCE((
    SELECT MAX(seq) FROM public.ampliguard_recibos WHERE user_id = p_user AND ano = v_ano
  ), 0))
  ON CONFLICT (user_id, ano) DO UPDATE
    SET last_seq = GREATEST(
      public.ampliguard_recibo_counters.last_seq,
      EXCLUDED.last_seq
    );

  UPDATE public.ampliguard_recibo_counters
  SET last_seq = last_seq + 1
  WHERE user_id = p_user AND ano = v_ano
  RETURNING last_seq INTO v_seq;

  v_numero := lpad(v_seq::text, 4, '0') || '/' || v_ano::text;

  BEGIN
    INSERT INTO public.ampliguard_recibos (user_id, vehicle_id, numero, seq, ano)
    VALUES (p_user, p_vehicle, v_numero, v_seq, v_ano);
  EXCEPTION
    WHEN unique_violation THEN
      SELECT numero INTO v_exist
      FROM public.ampliguard_recibos
      WHERE user_id = p_user AND vehicle_id = p_vehicle;
      IF FOUND THEN
        RETURN v_exist;
      END IF;
      RAISE;
  END;

  RETURN v_numero;
END;
$$;

COMMENT ON FUNCTION public.assign_ampliguard_recibo_numero(uuid, uuid, text, integer) IS
  'Reserva ou devolve o número do recibo oficial. Reimpressão não consome outro número.';

REVOKE ALL ON FUNCTION public.assign_ampliguard_recibo_numero(uuid, uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_ampliguard_recibo_numero(uuid, uuid, text, integer) TO authenticated;
