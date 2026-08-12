-- Registro fotográfico padronizado da vistoria (campos aditivos — não altera registros existentes).
-- Executar uma vez no SQL Editor do Supabase após vehicle_entry_inspections.sql.

ALTER TABLE vehicle_entry_inspection_photos
  ADD COLUMN IF NOT EXISTS photo_type text,
  ADD COLUMN IF NOT EXISTS photo_category text,
  ADD COLUMN IF NOT EXISTS photo_label text,
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS captured_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS captured_by_name text,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspection_photos_type
  ON vehicle_entry_inspection_photos(inspection_id, photo_type);

CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspection_photos_vehicle
  ON vehicle_entry_inspection_photos(vehicle_id);

NOTIFY pgrst, 'reload schema';
