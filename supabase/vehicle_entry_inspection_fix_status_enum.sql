-- Corrige erro ao finalizar vistoria:
--   invalid input value for enum vehicle_status: "AGUARDANDO_VISTORIA"
-- Executar uma vez no SQL Editor do Supabase (idempotente).

-- 1) Adiciona o status ao enum (cadastro de veículos novos)
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

-- 2) Colunas de modalidade (se ainda não existirem)
ALTER TABLE vehicle_entry_inspections
  ADD COLUMN IF NOT EXISTS inspection_variant text DEFAULT 'LEVE';

ALTER TABLE vehicle_entry_inspections
  ADD COLUMN IF NOT EXISTS form_extras jsonb DEFAULT '{}'::jsonb;

-- 3) Função de finalização — compara status como texto (retroativa + novos veículos)
CREATE OR REPLACE FUNCTION complete_vehicle_entry_inspection(
  p_user_id uuid,
  p_vehicle_id uuid,
  p_inspector_user_id uuid,
  p_inspector_name text,
  p_general_notes text,
  p_diagram_markers jsonb,
  p_items jsonb,
  p_damages jsonb,
  p_inspection_variant text DEFAULT 'LEVE',
  p_form_extras jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle vehicles%ROWTYPE;
  v_inspection_id uuid;
  v_number bigint;
  v_item jsonb;
  v_damage jsonb;
  v_damage_id uuid;
  v_variant text;
BEGIN
  v_variant := COALESCE(NULLIF(upper(trim(p_inspection_variant)), ''), 'LEVE');

  SELECT * INTO v_vehicle
  FROM vehicles
  WHERE id = p_vehicle_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veículo não encontrado.';
  END IF;

  IF v_vehicle.status::text = 'REMOVIDO' THEN
    RAISE EXCEPTION 'Veículo removido do pátio.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM vehicle_entry_inspections
    WHERE vehicle_id = p_vehicle_id
      AND inspection_type = 'ENTRADA'
      AND status = 'CONCLUIDA'
  ) THEN
    RAISE EXCEPTION 'Este veículo já possui vistoria de entrada concluída.';
  END IF;

  IF v_vehicle.status::text = 'AGUARDANDO_VISTORIA' THEN
    IF COALESCE(v_vehicle.entry_inspection_flow, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Veículo não pertence ao fluxo de vistoria eletrônica.';
    END IF;
  ELSIF v_vehicle.status::text NOT IN (
    'NO_PATIO', 'LIBERACAO_SOLICITADA', 'LIBERACAO_CONFIRMADA',
    'REMocao_CONFIRMADA', 'REMOCAO_CONFIRMADA'
  ) THEN
    RAISE EXCEPTION 'Veículo não está no pátio para vistoria.';
  END IF;

  v_number := nextval('vehicle_entry_inspection_number_seq');

  INSERT INTO vehicle_entry_inspections (
    user_id, vehicle_id, inspection_number, inspection_type, inspection_variant, status,
    general_notes, diagram_markers, form_extras,
    completed_at, completed_by_user_id, completed_by_name, updated_at
  ) VALUES (
    p_user_id, p_vehicle_id, v_number, 'ENTRADA', v_variant, 'CONCLUIDA',
    NULLIF(trim(p_general_notes), ''), COALESCE(p_diagram_markers, '[]'::jsonb), COALESCE(p_form_extras, '{}'::jsonb),
    now(), p_inspector_user_id, NULLIF(trim(p_inspector_name), ''), now()
  )
  RETURNING id INTO v_inspection_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO vehicle_entry_inspection_items (
      inspection_id, category, item_key, item_label, classification
    ) VALUES (
      v_inspection_id,
      v_item->>'category',
      v_item->>'item_key',
      v_item->>'item_label',
      v_item->>'classification'
    );
  END LOOP;

  FOR v_damage IN SELECT * FROM jsonb_array_elements(COALESCE(p_damages, '[]'::jsonb))
  LOOP
    INSERT INTO vehicle_entry_inspection_damages (
      inspection_id, item_key, area_label, damage_type, severity, description, notes
    ) VALUES (
      v_inspection_id,
      NULLIF(v_damage->>'item_key', ''),
      COALESCE(v_damage->>'area_label', 'Área'),
      COALESCE(v_damage->>'damage_type', 'Outro'),
      NULLIF(v_damage->>'severity', ''),
      NULLIF(v_damage->>'description', ''),
      NULLIF(v_damage->>'notes', '')
    )
    RETURNING id INTO v_damage_id;
  END LOOP;

  UPDATE vehicles
  SET status = 'NO_PATIO', updated_at = now()
  WHERE id = p_vehicle_id AND user_id = p_user_id AND status::text = 'AGUARDANDO_VISTORIA';

  RETURN jsonb_build_object(
    'inspection_id', v_inspection_id,
    'inspection_number', v_number,
    'vehicle_id', p_vehicle_id,
    'inspection_variant', v_variant
  );
END;
$$;

REVOKE ALL ON FUNCTION complete_vehicle_entry_inspection(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_vehicle_entry_inspection(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
