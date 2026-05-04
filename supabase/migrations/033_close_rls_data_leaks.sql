-- Migration 033: fechar RLS frouxa que vaza dados entre escolas
--
-- Incidente 2026-05-04 (auditoria): coord do Marista podia ler/editar
-- cronogramas, blocos, avulsos, respostas e relatorios de qualquer escola.
-- Policies permissivas legadas tornavam as estritas (coordinator_*, student_*)
-- inuteis (RLS = OR de policies).
--
-- Origem (cronogramas/blocos): migration 007 (out-2025) — quick fix do bug
-- aluno_id TEXT vs auth.uid() UUID. As policies estritas foram criadas DEPOIS,
-- mas as permissivas de 007 nunca foram removidas.
--
-- Estrategia (Karpathy §3 cirurgico):
--   - Drop policies permissivas onde ja existem estritas substitutas
--   - Substituir permissivas por estritas onde nao havia substituta
--   - Manter is_super_admin / service_role intactos (acesso server-side)

-- ===========================================================================
-- 1. cronogramas — coordinator_*, student_*, super_admin_* ja cobrem
-- ===========================================================================
DROP POLICY IF EXISTS "cronogramas_authenticated_all" ON public.cronogramas;

-- ===========================================================================
-- 2. blocos_cronograma — coordinator_*, student_*, super_admin_* ja cobrem
-- ===========================================================================
DROP POLICY IF EXISTS "blocos_authenticated_all" ON public.blocos_cronograma;

-- ===========================================================================
-- 3. alunos_avulsos_cronograma — super_admin + service_role ja cobrem
--    (findByMatricula filtra `if (scopedSchoolId) return null` antes de
--    cair no fallback de avulsos, entao coord nao precisa ler avulsos)
-- ===========================================================================
DROP POLICY IF EXISTS "authenticated_read_avulsos" ON public.alunos_avulsos_cronograma;

-- ===========================================================================
-- 4. student_question_responses — sem SELECT no codigo, sem-escola escrevia
--    com qualquer student_key (aluno podia plantar resposta em nome de outro)
-- ===========================================================================
DROP POLICY IF EXISTS "authenticated_select_sqr" ON public.student_question_responses;
DROP POLICY IF EXISTS "authenticated_insert_sqr" ON public.student_question_responses;

-- INSERT: aluno escreve so suas respostas (matricula OU id casa com profile_id)
CREATE POLICY "student_insert_own_sqr"
ON public.student_question_responses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.profile_id = auth.uid()
      AND (s.matricula = student_key OR s.id::text = student_key)
  )
);

-- UPDATE: idem (upsert do front bate em INSERT+UPDATE)
CREATE POLICY "student_update_own_sqr"
ON public.student_question_responses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.profile_id = auth.uid()
      AND (s.matricula = student_key OR s.id::text = student_key)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.profile_id = auth.uid()
      AND (s.matricula = student_key OR s.id::text = student_key)
  )
);

-- SELECT: aluno le suas respostas + coord le respostas de alunos da escola
CREATE POLICY "student_select_own_sqr"
ON public.student_question_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.profile_id = auth.uid()
      AND (s.matricula = student_key OR s.id::text = student_key)
  )
);

CREATE POLICY "coordinator_select_sqr"
ON public.student_question_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE (s.matricula = student_key OR s.id::text = student_key)
      AND s.school_id = public.get_user_school_id()
  )
);

CREATE POLICY "super_admin_sqr"
ON public.student_question_responses
FOR ALL
TO authenticated
USING (public.is_project_super_admin())
WITH CHECK (public.is_project_super_admin());

CREATE POLICY "service_role_sqr"
ON public.student_question_responses
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ===========================================================================
-- 5. student_reports — `school_id` ja existe na tabela, basta filtrar
-- ===========================================================================
DROP POLICY IF EXISTS "authenticated_select_student_reports" ON public.student_reports;
DROP POLICY IF EXISTS "authenticated_insert_student_reports" ON public.student_reports;

-- INSERT: criador (admin/coord) precisa ser da mesma escola do school_id gravado
-- (ou super_admin/service_role)
CREATE POLICY "coordinator_insert_reports"
ON public.student_reports
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = public.get_user_school_id()
  OR public.is_project_super_admin()
);

-- SELECT: coord le os da escola; aluno le os proprios via student_key
CREATE POLICY "coordinator_select_reports"
ON public.student_reports
FOR SELECT
TO authenticated
USING (school_id = public.get_user_school_id());

CREATE POLICY "student_select_own_reports"
ON public.student_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.profile_id = auth.uid()
      AND (s.matricula = student_key OR s.id::text = student_key)
  )
);

CREATE POLICY "super_admin_reports"
ON public.student_reports
FOR ALL
TO authenticated
USING (public.is_project_super_admin())
WITH CHECK (public.is_project_super_admin());

CREATE POLICY "service_role_reports"
ON public.student_reports
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
