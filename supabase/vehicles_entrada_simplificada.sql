-- Entrada simplificada: quem entregou o veículo e fotografia opcional da placa.
-- Não apaga dados nem fotografias já gravados.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS quem_trouxe text;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS foto_entrada_path text;
