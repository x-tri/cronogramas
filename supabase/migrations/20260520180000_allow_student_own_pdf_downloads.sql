-- Permite que o portal do aluno gere signed URL somente para PDFs do proprio aluno.
--
-- Contexto:
-- - A migration 035 fechou o bucket cronogramas-pdf para acesso direto de alunos.
-- - O portal do aluno lista pdf_history e chama createSignedUrl no browser.
-- - Sem uma policy propria, a signed URL falha e o card some da area "Suas listas e materiais".

CREATE OR REPLACE FUNCTION public.is_student_own_pdf_storage_path(p_storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pdf_history ph
    JOIN public.students s
      ON s.profile_id = auth.uid()
     AND s.matricula = ph.matricula
    WHERE ph.storage_path = p_storage_path
  );
$$;

REVOKE ALL ON FUNCTION public.is_student_own_pdf_storage_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_student_own_pdf_storage_path(text) TO authenticated;

DROP POLICY IF EXISTS "cronogramas_pdf_student_select_own" ON storage.objects;

CREATE POLICY "cronogramas_pdf_student_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cronogramas-pdf'
  AND public.is_student_own_pdf_storage_path(name)
);
