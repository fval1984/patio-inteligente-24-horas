-- Melhorias da Vistoria (veículo trancado, INEXISTENTE/SEM ACESSO, fotos por item).
-- Aditivo e idempotente. NÃO apaga vistorias, veículos, itens ou fotos.

-- Status SEM_ACESSO_TRANCADO (itens internos com veículo trancado)
ALTER TABLE public.vehicle_entry_inspection_items
  DROP CONSTRAINT IF EXISTS vehicle_entry_inspection_items_class_check;

ALTER TABLE public.vehicle_entry_inspection_items
  ADD CONSTRAINT vehicle_entry_inspection_items_class_check CHECK (
    classification IS NULL
    OR classification IN (
      'BOM',
      'REGULAR',
      'DANIFICADO',
      'SEM_TESTE',
      'INEXISTENTE',
      'SEM_ACESSO_TRANCADO'
    )
  );

-- Vínculo foto → item da vistoria (fotos de item danificado)
ALTER TABLE public.vehicle_entry_inspection_photos
  ADD COLUMN IF NOT EXISTS item_key text;

CREATE INDEX IF NOT EXISTS idx_vehicle_entry_inspection_photos_item
  ON public.vehicle_entry_inspection_photos(inspection_id, item_key);

NOTIFY pgrst, 'reload schema';
