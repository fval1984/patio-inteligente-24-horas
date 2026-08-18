-- Garante que cada vistoria (nº 1, 2, 3…) tenha os próprios itens.
-- Unique global em item_key fazia a 2ª vistoria perder as marcações.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'vehicle_entry_inspection_items'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%inspection_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.vehicle_entry_inspection_items DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.vehicle_entry_inspection_items
  DROP CONSTRAINT IF EXISTS vehicle_entry_inspection_items_item_key_key;

ALTER TABLE public.vehicle_entry_inspection_items
  DROP CONSTRAINT IF EXISTS vehicle_entry_inspection_items_unique;

ALTER TABLE public.vehicle_entry_inspection_items
  ADD CONSTRAINT vehicle_entry_inspection_items_unique UNIQUE (inspection_id, item_key);

NOTIFY pgrst, 'reload schema';
