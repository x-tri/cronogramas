-- CRITICAL 1: Torna bucket cronogramas-pdf privado para evitar vazamento de PII.
--
-- Problema: PDFs do bucket cronogramas-pdf contêm nome, matrícula, TRI e
-- relatórios pedagógicos — acessíveis via URL pública por qualquer pessoa com
-- o link. Mudamos o bucket para privado e exigimos signed URLs (TTL curto)
-- emitidas após autenticação, mantendo o fluxo de "copiar link e enviar
-- pelo WhatsApp" porém com expiração.
--
-- Policies de INSERT/UPDATE/DELETE já existentes em 014_relax_pdf_storage_policies
-- continuam válidas (authenticated-only). Apenas reforçamos a de SELECT, que até
-- então era aberta via URL pública do bucket.

-- 1) Bucket privado
UPDATE storage.buckets
SET public = false
WHERE id = 'cronogramas-pdf';

-- 2) SELECT policy: apenas autenticados. Escritas continuam como em 014.
DROP POLICY IF EXISTS "cronogramas_pdf_select_authenticated" ON storage.objects;

CREATE POLICY "cronogramas_pdf_select_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'cronogramas-pdf');
