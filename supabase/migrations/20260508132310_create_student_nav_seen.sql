-- Persistencia de novidades vistas no portal do aluno.
--
-- A tabela guarda apenas fingerprints de seções do app (sem conteúdo
-- educacional/PII). O frontend usa isso para apagar o dot vermelho depois que
-- o aluno abre Plano, Simulados ou Avisos em qualquer dispositivo.

CREATE TABLE IF NOT EXISTS public.student_nav_seen (
  profile_id  uuid        NOT NULL DEFAULT auth.uid(),
  section     text        NOT NULL,
  fingerprint text        NOT NULL,
  seen_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_nav_seen_pkey PRIMARY KEY (profile_id, section),
  CONSTRAINT student_nav_seen_section_check
    CHECK (section IN ('plano', 'simulados', 'avisos'))
);

COMMENT ON TABLE public.student_nav_seen IS
  'Marcadores de novidades vistas por perfil autenticado no portal do aluno.';
COMMENT ON COLUMN public.student_nav_seen.fingerprint IS
  'Hash/fingerprint funcional da seção vista; nao armazena dados educacionais.';

ALTER TABLE public.student_nav_seen ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.student_nav_seen TO authenticated;
REVOKE ALL ON public.student_nav_seen FROM anon;

DROP POLICY IF EXISTS "student_nav_seen_select_own" ON public.student_nav_seen;
DROP POLICY IF EXISTS "student_nav_seen_insert_own" ON public.student_nav_seen;
DROP POLICY IF EXISTS "student_nav_seen_update_own" ON public.student_nav_seen;

CREATE POLICY "student_nav_seen_select_own"
ON public.student_nav_seen
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = profile_id);

CREATE POLICY "student_nav_seen_insert_own"
ON public.student_nav_seen
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "student_nav_seen_update_own"
ON public.student_nav_seen
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = profile_id)
WITH CHECK ((SELECT auth.uid()) = profile_id);
