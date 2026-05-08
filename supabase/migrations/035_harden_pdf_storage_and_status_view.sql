-- Migration 035: reforca isolamento de PDFs por escola.
--
-- Contexto:
-- - 014 relaxou INSERT/UPDATE/DELETE do bucket cronogramas-pdf para qualquer
--   usuario autenticado.
-- - 020 tornou o bucket privado, mas SELECT continuou amplo para authenticated.
-- - 025 criou a view pdf_history_with_status sem security_invoker explicito.
--
-- Regra desejada:
-- - super_admin opera qualquer PDF.
-- - coordinator opera apenas paths cujo primeiro segmento e sua school_id.
-- - aluno nao acessa storage diretamente; downloads devem passar por fluxo
--   validado pelo app/RPC especifico.

UPDATE storage.buckets
SET public = false
WHERE id = 'cronogramas-pdf';

DROP POLICY IF EXISTS "cronogramas_pdf_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_delete_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_select_scoped" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_insert_scoped" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_update_scoped" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_delete_scoped" ON storage.objects;

CREATE POLICY "cronogramas_pdf_select_scoped"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cronogramas-pdf'
  AND (
    public.is_super_admin()
    OR (
      public.current_project_role() = 'coordinator'
      AND public.current_school_id() IS NOT NULL
      AND split_part(name, '/', 1) = public.current_school_id()::text
    )
  )
);

CREATE POLICY "cronogramas_pdf_insert_scoped"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cronogramas-pdf'
  AND (
    public.is_super_admin()
    OR (
      public.current_project_role() = 'coordinator'
      AND public.current_school_id() IS NOT NULL
      AND split_part(name, '/', 1) = public.current_school_id()::text
    )
  )
);

CREATE POLICY "cronogramas_pdf_update_scoped"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cronogramas-pdf'
  AND (
    public.is_super_admin()
    OR (
      public.current_project_role() = 'coordinator'
      AND public.current_school_id() IS NOT NULL
      AND split_part(name, '/', 1) = public.current_school_id()::text
    )
  )
)
WITH CHECK (
  bucket_id = 'cronogramas-pdf'
  AND (
    public.is_super_admin()
    OR (
      public.current_project_role() = 'coordinator'
      AND public.current_school_id() IS NOT NULL
      AND split_part(name, '/', 1) = public.current_school_id()::text
    )
  )
);

CREATE POLICY "cronogramas_pdf_delete_scoped"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cronogramas-pdf'
  AND (
    public.is_super_admin()
    OR (
      public.current_project_role() = 'coordinator'
      AND public.current_school_id() IS NOT NULL
      AND split_part(name, '/', 1) = public.current_school_id()::text
    )
  )
);

CREATE OR REPLACE VIEW public.pdf_history_with_status
WITH (security_invoker = true)
AS
SELECT
  ph.*,
  COALESCE(dl.download_count, 0) AS download_count,
  dl.first_downloaded_at,
  dl.last_downloaded_at
FROM public.pdf_history ph
LEFT JOIN (
  SELECT
    pdf_history_id,
    COUNT(*) AS download_count,
    MIN(downloaded_at) AS first_downloaded_at,
    MAX(downloaded_at) AS last_downloaded_at
  FROM public.pdf_download_log
  GROUP BY pdf_history_id
) dl ON dl.pdf_history_id = ph.id;

GRANT SELECT ON public.pdf_history_with_status TO authenticated;
