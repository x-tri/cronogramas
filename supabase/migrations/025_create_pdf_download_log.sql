-- Migration 025: tracking de download de PDFs pelo aluno
--
-- Necessidade pedagogica:
--   Coordenadores precisam visualizar quem baixou (e quem nao baixou) cada
--   lista/material entregue, similar ao controle ja existente de simulados
--   respondidos vs nao-respondidos (ver simulado-ranking.tsx).
--
-- Decisoes:
--   - "Primeira vez somente": UNIQUE (pdf_history_id, student_id) garante
--     1 linha por par; INSERT do aluno usa ON CONFLICT DO NOTHING para
--     preservar a primeira data e evitar erros em re-cliques.
--   - Tracking client-side no clique do <a> (acordado com PO em 2026-04-25):
--     refletir abertura do link e nao confirmacao real do download do
--     navegador (que nao da pra detectar de forma confiavel).
--   - Denormalizacao defensiva (matricula + school_id) sobrevive a DELETE
--     do aluno (ON DELETE SET NULL em student_id).
--
-- Tabela: pdf_download_log
-- View:   pdf_history_with_status (LEFT JOIN agregado para o admin)
-- RLS:
--   - student INSERT/SELECT only se for o proprio (students.profile_id = auth.uid())
--   - super_admin SELECT total
--   - coordinator SELECT da propria escola

-- ---------------------------------------------------------------------------
-- pdf_download_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pdf_download_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_history_id  uuid        NOT NULL REFERENCES public.pdf_history(id) ON DELETE CASCADE,
  student_id      uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  matricula       text,
  school_id       uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  downloaded_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_download_log_pdf_student_unique UNIQUE (pdf_history_id, student_id)
);

-- Indices: queries quentes do admin (status por PDF, listagem por escola).
CREATE INDEX IF NOT EXISTS idx_pdf_download_log_pdf
  ON public.pdf_download_log (pdf_history_id);

CREATE INDEX IF NOT EXISTS idx_pdf_download_log_school_date
  ON public.pdf_download_log (school_id, downloaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_pdf_download_log_student
  ON public.pdf_download_log (student_id, downloaded_at DESC);

COMMENT ON TABLE public.pdf_download_log IS
  'Log de primeiro download de cada PDF por cada aluno. UNIQUE (pdf_history_id, student_id) preserva primeira data.';
COMMENT ON COLUMN public.pdf_download_log.matricula IS
  'Denormalizado: sobrevive a DELETE do aluno para auditoria historica.';
COMMENT ON COLUMN public.pdf_download_log.school_id IS
  'Denormalizado: usado pela RLS do coordinator (filtragem rapida sem JOIN).';

-- ---------------------------------------------------------------------------
-- View: pdf_history_with_status
-- Combina pdf_history com agregacao do log para o admin consultar tudo numa
-- query so. Mantem todas as colunas originais (ph.*) para o frontend nao
-- precisar mudar a interface PdfRecord.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pdf_history_with_status AS
SELECT
  ph.*,
  COALESCE(dl.download_count, 0) AS download_count,
  dl.first_downloaded_at,
  dl.last_downloaded_at
FROM public.pdf_history ph
LEFT JOIN (
  SELECT
    pdf_history_id,
    COUNT(*)            AS download_count,
    MIN(downloaded_at)  AS first_downloaded_at,
    MAX(downloaded_at)  AS last_downloaded_at
  FROM public.pdf_download_log
  GROUP BY pdf_history_id
) dl ON dl.pdf_history_id = ph.id;

COMMENT ON VIEW public.pdf_history_with_status IS
  'pdf_history + agregacao de pdf_download_log. Usada pelo admin para mostrar status de download.';

-- View herda RLS das tabelas-base (pdf_history + pdf_download_log).
GRANT SELECT ON public.pdf_history_with_status TO authenticated;

-- ---------------------------------------------------------------------------
-- Grants base
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.pdf_download_log TO authenticated;
REVOKE ALL          ON public.pdf_download_log FROM anon;

-- ---------------------------------------------------------------------------
-- RLS
-- Helpers reutilizados: is_super_admin(), current_school_id(),
-- current_project_role() (ver 008_create_mentor_intelligence_tables.sql).
-- ---------------------------------------------------------------------------
ALTER TABLE public.pdf_download_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pdf_download_log_student_insert"  ON public.pdf_download_log;
DROP POLICY IF EXISTS "pdf_download_log_student_select"  ON public.pdf_download_log;
DROP POLICY IF EXISTS "pdf_download_log_admin_select"    ON public.pdf_download_log;
DROP POLICY IF EXISTS "pdf_download_log_coord_select"    ON public.pdf_download_log;

-- student INSERT: so o proprio aluno (students.profile_id = auth.uid())
CREATE POLICY "pdf_download_log_student_insert"
ON public.pdf_download_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = pdf_download_log.student_id
      AND s.profile_id = auth.uid()
  )
);

-- student SELECT: ve os proprios downloads (util para "ja baixei isso?")
CREATE POLICY "pdf_download_log_student_select"
ON public.pdf_download_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = pdf_download_log.student_id
      AND s.profile_id = auth.uid()
  )
);

-- super_admin: SELECT total
CREATE POLICY "pdf_download_log_admin_select"
ON public.pdf_download_log
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- coordinator: SELECT da propria escola (school_id ja esta denormalizado)
CREATE POLICY "pdf_download_log_coord_select"
ON public.pdf_download_log
FOR SELECT
TO authenticated
USING (
  public.current_project_role() = 'coordinator'
  AND school_id = public.current_school_id()
);
