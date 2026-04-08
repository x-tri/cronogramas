-- Ajuste pragmático: o bucket cronogramas-pdf já é público por URL.
-- Então o gargalo aqui é permitir que qualquer usuário autenticado do app
-- consiga gravar, atualizar e remover objetos desse bucket.

DROP POLICY IF EXISTS "cronogramas_pdf_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_delete_authenticated" ON storage.objects;

CREATE POLICY "cronogramas_pdf_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cronogramas-pdf');

CREATE POLICY "cronogramas_pdf_update_authenticated"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'cronogramas-pdf')
WITH CHECK (bucket_id = 'cronogramas-pdf');

CREATE POLICY "cronogramas_pdf_delete_authenticated"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'cronogramas-pdf');
