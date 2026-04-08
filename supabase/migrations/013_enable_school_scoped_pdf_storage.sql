-- Habilita upload/atualização/remoção de PDFs no bucket cronogramas-pdf
-- com isolamento por escola usando o primeiro segmento do path.
-- Exemplo de path: {school_id}/{turma}/{arquivo}.pdf

INSERT INTO storage.buckets (id, name, public)
VALUES ('cronogramas-pdf', 'cronogramas-pdf', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cronogramas_pdf_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cronogramas_pdf_delete_authenticated" ON storage.objects;

CREATE POLICY "cronogramas_pdf_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cronogramas-pdf'
  AND (
    EXISTS (
      SELECT 1
      FROM public.project_users pu
      WHERE pu.auth_uid = auth.uid()
        AND pu.is_active = true
        AND pu.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_users pu
      WHERE pu.auth_uid = auth.uid()
        AND pu.is_active = true
        AND pu.school_id IS NOT NULL
        AND split_part(name, '/', 1) = pu.school_id::text
    )
  )
);

CREATE POLICY "cronogramas_pdf_update_authenticated"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cronogramas-pdf'
  AND (
    EXISTS (
      SELECT 1
      FROM public.project_users pu
      WHERE pu.auth_uid = auth.uid()
        AND pu.is_active = true
        AND pu.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_users pu
      WHERE pu.auth_uid = auth.uid()
        AND pu.is_active = true
        AND pu.school_id IS NOT NULL
        AND split_part(name, '/', 1) = pu.school_id::text
    )
  )
)
WITH CHECK (
  bucket_id = 'cronogramas-pdf'
  AND (
    EXISTS (
      SELECT 1
      FROM public.project_users pu
      WHERE pu.auth_uid = auth.uid()
        AND pu.is_active = true
        AND pu.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_users pu
      WHERE pu.auth_uid = auth.uid()
        AND pu.is_active = true
        AND pu.school_id IS NOT NULL
        AND split_part(name, '/', 1) = pu.school_id::text
    )
  )
);

CREATE POLICY "cronogramas_pdf_delete_authenticated"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cronogramas-pdf'
  AND (
    EXISTS (
      SELECT 1
      FROM public.project_users pu
      WHERE pu.auth_uid = auth.uid()
        AND pu.is_active = true
        AND pu.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_users pu
      WHERE pu.auth_uid = auth.uid()
        AND pu.is_active = true
        AND pu.school_id IS NOT NULL
        AND split_part(name, '/', 1) = pu.school_id::text
    )
  )
);
