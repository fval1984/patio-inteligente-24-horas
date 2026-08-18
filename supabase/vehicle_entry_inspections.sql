-- Vistoria de entrada (novos veículos) — executar uma vez no SQL Editor do Supabase.
-- NÃO altera registros existentes. Colunas novas aceitam NULL para veículos antigos.

-- Status AGUARDANDO_VISTORIA (cadastro → vistoria → VNP). Ver também vehicles_status_aguardando_vistoria.sql.
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

-- Campos opcionais no cadastro (somente preenchidos em novos registros)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ano text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cor text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chassi text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS entry_inspection_flow boolean;
COMMENT ON COLUMN vehicles.entry_inspection_flow IS 'true = cadastro após implementação da vistoria eletrônica; NULL/false = legado';

-- Numeração sequencial global (protegida no banco)
CREATE SEQUENCE IF NOT EXISTS vehicle_entry_inspection_number_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS vehicle_entry_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  inspection_number bigint NOT NULL,
  inspection_type text NOT NULL DEFAULT 'ENTRADA',
  status text NOT NULL DEFAULT 'EM_ANDAMENTO',
  general_notes text,
  diagram_markers jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  completed_by_user_id uuid,
  completed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_entry_inspections_number_unique UNIQUE (inspection_number),
  CONSTRAINT vehicle_entry_inspections_vehicle_type_unique UNIQUE (vehicle_id, inspection_type)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspections_user ON vehicle_entry_inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspections_vehicle ON vehicle_entry_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspections_status ON vehicle_entry_inspections(status);

CREATE TABLE IF NOT EXISTS vehicle_entry_inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES vehicle_entry_inspections(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_key text NOT NULL,
  item_label text NOT NULL,
  classification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_entry_inspection_items_unique UNIQUE (inspection_id, item_key),
  CONSTRAINT vehicle_entry_inspection_items_class_check CHECK (
    classification IS NULL OR classification IN ('BOM', 'REGULAR', 'DANIFICADO', 'SEM_TESTE', 'INEXISTENTE')
  )
);

CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspection_items_inspection ON vehicle_entry_inspection_items(inspection_id);

CREATE TABLE IF NOT EXISTS vehicle_entry_inspection_damages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES vehicle_entry_inspections(id) ON DELETE CASCADE,
  item_key text,
  area_label text NOT NULL,
  damage_type text NOT NULL,
  severity text,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspection_damages_inspection ON vehicle_entry_inspection_damages(inspection_id);

CREATE TABLE IF NOT EXISTS vehicle_entry_inspection_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES vehicle_entry_inspections(id) ON DELETE CASCADE,
  damage_id uuid REFERENCES vehicle_entry_inspection_damages(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspection_photos_inspection ON vehicle_entry_inspection_photos(inspection_id);

-- RLS
ALTER TABLE vehicle_entry_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_entry_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_entry_inspection_damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_entry_inspection_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_entry_inspections_own ON vehicle_entry_inspections;
CREATE POLICY vehicle_entry_inspections_own ON vehicle_entry_inspections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS vehicle_entry_inspection_items_own ON vehicle_entry_inspection_items;
CREATE POLICY vehicle_entry_inspection_items_own ON vehicle_entry_inspection_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicle_entry_inspections i
      WHERE i.id = inspection_id AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicle_entry_inspections i
      WHERE i.id = inspection_id AND i.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vehicle_entry_inspection_damages_own ON vehicle_entry_inspection_damages;
CREATE POLICY vehicle_entry_inspection_damages_own ON vehicle_entry_inspection_damages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicle_entry_inspections i
      WHERE i.id = inspection_id AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicle_entry_inspections i
      WHERE i.id = inspection_id AND i.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vehicle_entry_inspection_photos_own ON vehicle_entry_inspection_photos;
CREATE POLICY vehicle_entry_inspection_photos_own ON vehicle_entry_inspection_photos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicle_entry_inspections i
      WHERE i.id = inspection_id AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicle_entry_inspections i
      WHERE i.id = inspection_id AND i.user_id = auth.uid()
    )
  );

-- Storage bucket (privado) — criar também em Storage UI se o insert falhar
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-inspection-photos', 'vehicle-inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS vehicle_inspection_photos_select ON storage.objects;
CREATE POLICY vehicle_inspection_photos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vehicle-inspection-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS vehicle_inspection_photos_insert ON storage.objects;
CREATE POLICY vehicle_inspection_photos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-inspection-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS vehicle_inspection_photos_delete ON storage.objects;
CREATE POLICY vehicle_inspection_photos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-inspection-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Finalização atômica: número sequencial + gravação + liberação para VNP
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
    )
    ON CONFLICT (inspection_id, item_key) DO UPDATE SET
      category = EXCLUDED.category,
      item_label = EXCLUDED.item_label,
      classification = EXCLUDED.classification;
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

  -- Retroativa: veículo já no pátio — não altera status nem demais campos

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
