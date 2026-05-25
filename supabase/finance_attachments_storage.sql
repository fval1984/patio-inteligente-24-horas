-- Bucket para comprovantes financeiros (Fase 4)
-- Execute no SQL Editor do Supabase após criar o bucket "finance-attachments" em Storage (privado).

insert into storage.buckets (id, name, public)
values ('finance-attachments', 'finance-attachments', false)
on conflict (id) do nothing;

-- Leitura: apenas arquivos na pasta do próprio utilizador (auth.uid())
create policy "finance_attachments_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'finance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Upload
create policy "finance_attachments_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'finance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Atualizar (upsert)
create policy "finance_attachments_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'finance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Remover
create policy "finance_attachments_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'finance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
